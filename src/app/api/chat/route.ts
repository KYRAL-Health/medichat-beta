import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import {
  chatCompletion,
  getChatModel,
  getExtractModel,
  type AiTool,
  type ChatMessage,
} from "@/server/ai";
import { proposeMemory, retrieveMemories } from "@/server/ai/tools";
import { proposePatientRecordSuggestion } from "@/server/ai/patientTools";
import { searchPubMed, formatArticleCitations } from "@/server/ai/pubmedTools";
import { db } from "@/server/db";
import { chatMessages, chatThreads, documents, usageLogs } from "@/server/db/schema";
import {
  buildPatientContext,
  stringifyPatientContext,
} from "@/server/patients/context";
import { getDocumentInsightsData } from "@/server/documents/insights";

export const runtime = "nodejs";

const ChatSchema = z.object({
  mode: z.enum(["patient", "physician"]),
  patientUserId: z.string().optional(),
  threadId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
  documentIds: z.array(z.string().uuid()).optional(),
});

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Classifies whether a message is a medical question and produces a PubMed query.
 * Uses the extract model (cheap, fast) with temperature 0 for determinism.
 * Returns { isMedical: false, pubmedQuery: null } on any failure so chat always proceeds.
 * Accepts up to the last 5 chat history messages as context for better classification.
 */
async function classifyMedicalQuery(
  message: string,
  recentHistory: ChatMessage[] = []
): Promise<{ isMedical: boolean; pubmedQuery: string | null }> {
  try {
    const historyMessages = recentHistory.slice(-5);
    const resp = await chatCompletion({
      model: getExtractModel(),
      messages: [
        {
          role: "system",
          content:
            "You are a medical question classifier. Respond ONLY with a valid JSON object — no markdown, no prose.\n" +
            'Schema: { "isMedical": boolean, "pubmedQuery": string | null }\n' +
            "Set isMedical=true if the message asks about medical conditions, symptoms, treatments, medications, diagnostics, physiology, or clinical guidelines.\n" +
            "If isMedical=true, produce a concise PubMed search query (2-6 keywords) that would find relevant peer-reviewed articles.\n" +
            "If isMedical=false, set pubmedQuery=null.",
        },
        ...historyMessages,
        { role: "user", content: message },
      ],
      temperature: 0,
    });
    const raw = resp.choices[0]?.message?.content ?? "";
    const parsed = safeJsonParse<{ isMedical: boolean; pubmedQuery: string | null }>(raw);
    if (!parsed || typeof parsed.isMedical !== "boolean") {
      return { isMedical: false, pubmedQuery: null };
    }
    return {
      isMedical: parsed.isMedical,
      pubmedQuery: parsed.isMedical && parsed.pubmedQuery ? parsed.pubmedQuery : null,
    };
  } catch {
    return { isMedical: false, pubmedQuery: null };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const parsed = ChatSchema.safeParse(await req.json());
    if (!parsed.success) {
      const details =
        process.env.NODE_ENV !== "production"
          ? parsed.error.flatten()
          : undefined;
      return NextResponse.json(
        { error: "Invalid request", details },
        { status: 400 }
      );
    }

    const { mode, message, documentIds } = parsed.data;
    const patientUserId =
      mode === "patient" ? userId : parsed.data.patientUserId ?? null;

    if (!patientUserId) {
      return NextResponse.json(
        { error: "Missing patientUserId" },
        { status: 400 }
      );
    }

    if (mode === "physician") {
      await assertPatientAccess({ viewerUserId: userId, patientUserId });
    }

    // Verify document access if provided
    let docContext = "";
    if (documentIds?.length) {
      const docs = await db.query.documents.findMany({
        where: inArray(documents.id, documentIds),
      });
      
      const validDocs = docs.filter(d => d.patientUserId === patientUserId);
      if (validDocs.length) {
        docContext = `\n\nThe user has attached the following documents to this message:\n${validDocs.map(d => `- ${d.originalFileName} (ID: ${d.id})`).join("\n")}\nYou can use the 'getDocumentInsights' tool to read their contents.`;
      }
    }

    // Ensure thread exists
    let threadId = parsed.data.threadId ?? null;
    if (threadId) {
      const thread = await db.query.chatThreads.findFirst({
        where: eq(chatThreads.id, threadId),
      });
      if (!thread || thread.patientUserId !== patientUserId) {
        threadId = null;
      }
    }

    if (!threadId) {
      const thread = await db
        .insert(chatThreads)
        .values({
          patientUserId,
          createdByUserId: userId,
          contextMode: mode,
          title: mode === "patient" ? "Patient chat" : "Physician chat",
          updatedAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0]);
      if (!thread) {
        return NextResponse.json(
          { error: "THREAD_CREATE_FAILED" },
          { status: 500 }
        );
      }
      threadId = thread.id;
    }

    const userMsg = await db
      .insert(chatMessages)
      .values({
        threadId,
        senderRole: "user",
        content: message,
      })
      .returning()
      .then((rows) => rows[0]);

    // Load some recent messages for context
    const recentMessages = await db.query.chatMessages.findMany({
      where: eq(chatMessages.threadId, threadId),
      orderBy: [desc(chatMessages.createdAt)],
      limit: 30,
    });
    const chronological = [...recentMessages].reverse();

    const patientCtx = await buildPatientContext(patientUserId);
    const patientCtxText = stringifyPatientContext(patientCtx);

    // --- Deterministic PubMed orchestration ---
    // Classify the query with a cheap model call, then fetch citations ourselves.
    // The model never gets a searchMedicalLiterature tool; evidence is injected into the system prompt.
    const classifierHistory: ChatMessage[] = chronological
      .filter((m) => m.id !== userMsg?.id && (m.senderRole === "user" || m.senderRole === "assistant"))
      .slice(-10)
      .map((m) => ({ role: m.senderRole as "user" | "assistant", content: m.content }));
    const { isMedical, pubmedQuery } = await classifyMedicalQuery(message, classifierHistory);
    let citationsBlock: string | null = null;
    if (isMedical && pubmedQuery) {
      console.log("[PubMed] Medical question detected. Query:", pubmedQuery);
      try {
        const articles = await searchPubMed(pubmedQuery, 5);
        if (articles.length > 0) {
          citationsBlock = formatArticleCitations(articles);
          console.log("[PubMed] Citations fetched:", articles.length);
        } else {
          console.log("[PubMed] No articles found for query:", pubmedQuery);
        }
      } catch (e) {
        console.error("[PubMed] Search failed:", e);
      }
    }

    const patientSystem = [
      "You are MediChat, a medical AI assistant speaking directly to the patient.",
      "Be empathetic, clear, and structured.",
      "If symptoms suggest an emergency, advise seeking urgent care.",
      "Ground your response in PatientContext when available.",
      "Ask clarifying questions when appropriate.",
      "Do not provide medical advice; provide informational guidance and encourage clinician review where appropriate.",

      "Response Style Rules:",
      "- Keep explanations clear and patient-friendly.",
      "- When citations are required, completeness takes priority over brevity.",
      "- Do NOT omit required structural sections for the sake of conciseness.",

      "Personalization:",
      "- Use retrieveMemories to fetch accepted memories for the current user (patient context only).",
      "- You MAY call logMemory to propose remembering stable health history.",
      "- If you identify a concrete medical record update, call proposePatientRecordSuggestion.",
      "- Only propose memories that are clear and likely to remain true.",

      ...(citationsBlock
        ? [
          "",
          "=== MANDATORY EVIDENCE REQUIREMENT ===",
          "Peer-reviewed PubMed citations have already been retrieved.",
          "You MUST append a section titled exactly:",
          "References",
          "",
          "In that section, you MUST copy the citation block below EXACTLY as written.",
          "Do NOT modify formatting.",
          "Do NOT summarize.",
          "Do NOT reorder.",
          "Do NOT omit any line.",
          "Do NOT add extra commentary inside the References section.",
          "",
          "If the References section is missing or altered, the response is INVALID.",
          "",
          "Citation Block (copy verbatim below the 'References' heading):",
          citationsBlock,
          "",
          "FINAL CHECK BEFORE RESPONDING:",
          "Ensure your response ends with the References section exactly as provided."
        ]
        : isMedical
          ? [
            "",
            "Evidence Notice:",
            "- A PubMed search was performed but returned no results.",
            "- Inform the patient that no peer-reviewed citations were found.",
            "- Encourage clinician consultation."
          ]
          : []),

      "",
      patientCtxText,
      docContext,
    ].join("\n");

    const physicianSystem = [
      "You are MediChat, a medical AI assistant speaking to a clinician.",
      "Respond in a structured clinical format:",
      "- Brief Summary",
      "- Key Risks / Red Flags",
      "- Clarifying Questions",
      "- Suggested Next Evaluations (informational only)",

      "Be precise and clinically concise.",
      "Ground your response in PatientContext; do not hallucinate missing data.",
      "Do not provide medical advice; provide informational suggestions and encourage clinician judgment.",

      "Personalization:",
      "- Use retrieveMemories scoped to this patient and physician mode.",
      "- You MAY log stable patient-specific baseline context.",
      "- Propose concrete medical record updates when appropriate.",
      "- Only propose stable, specific facts.",

      ...(citationsBlock
        ? [
          "",
          "=== MANDATORY EVIDENCE REQUIREMENT ===",
          "Peer-reviewed PubMed citations have already been retrieved.",
          "You MUST append a section titled exactly:",
          "Key Studies",
          "",
          "In that section, copy the citation block below EXACTLY as written.",
          "Do NOT modify formatting.",
          "Do NOT summarize.",
          "Do NOT reorder.",
          "Do NOT omit any citation.",
          "Do NOT add commentary inside the Key Studies section.",
          "",
          "If the Key Studies section is missing or altered, the response is INVALID.",
          "",
          "Citation Block (copy verbatim below the 'Key Studies' heading):",
          citationsBlock,
          "",
          "FINAL CHECK BEFORE RESPONDING:",
          "Ensure your response ends with the Key Studies section exactly as provided."
        ]
        : isMedical
          ? [
            "",
            "Evidence Notice:",
            "- A PubMed search was performed but returned no results.",
            "- State the absence of retrieved citations.",
          ]
          : []),

      "",
      patientCtxText,
      docContext,
    ].join("\n");

    const tools: AiTool[] = [
      {
        type: "function",
        function: {
          name: "retrieveMemories",
          description:
            "Fetch relevant accepted memories for the current authenticated user to personalize responses.",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "integer", minimum: 1, maximum: 50 },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "logMemory",
          description:
            "Propose a memory worth remembering about the user to personalize future responses. The user must confirm later.",
          parameters: {
            type: "object",
            properties: {
              memoryText: { type: "string", minLength: 1, maxLength: 500 },
              category: { type: "string", maxLength: 50 },
            },
            required: ["memoryText"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getDocumentInsights",
          description:
            "Read insights and extracted data from a specific document attached to this conversation.",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: "The UUID of the document to read." },
            },
            required: ["documentId"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "proposePatientRecordSuggestion",
          description: "Propose a structured update to the patient's record (vitals, labs, medications, conditions, or profile).",
          parameters: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["profile_update", "vital", "lab", "medication", "condition"] },
              summaryText: { type: "string", description: "Human readable summary of what is being changed/added." },
              payloadJson: {
                type: "object",
                description: "The structured data for the update. Fields match the database schema for the kind.",
                additionalProperties: true,
              },
            },
            required: ["kind", "summaryText", "payloadJson"],
            additionalProperties: false,
          },
        },
      },
    ];

    const system = mode === "physician" ? physicianSystem : patientSystem;

    console.log(system);

    let convo: ChatMessage[] = [{ role: "system", content: system }];

    for (const m of chronological) {
      if (m.senderRole === "tool") {
        continue;
      } else if (m.senderRole === "assistant") {
        convo.push({ role: "assistant", content: m.content });
      } else if (m.senderRole === "user") {
        convo.push({ role: "user", content: m.content });
      }
    }

    const proposedMemories: Array<{
      id: string;
      memoryText: string;
      category: string | null;
    }> = [];

    const proposedSuggestions: Array<{
        id: string;
        kind: string;
        summaryText: string;
    }> = [];

    // Tool loop (max 3 iterations)
    for (let i = 0; i < 3; i++) {
      const resp = await chatCompletion({
        model: getChatModel(),
        messages: convo,
        tools,
        tool_choice: "auto",
        temperature: 0.4,
      });

      // Record usage for this model call (tokens). Keep logs if user deleted: userId is nullable and set-null on user deletion.
      try {
        const tokens = (resp as any)?.usage?.total_tokens ?? 0;
        await db.insert(usageLogs).values({
          userId: userId ?? null,
          kind: "chat",
          threadId: threadId ?? null,
          messageId: userMsg?.id ?? null,
          tokens,
          meta: { model: getChatModel(), usage: (resp as any)?.usage ?? null },
        });
      } catch (e) {
        console.error("usage log failed", e);
      }

      const choice = resp.choices[0];
      const assistant = choice?.message;
      if (!assistant) {
        return NextResponse.json(
          { error: "MODEL_NO_RESPONSE" },
          { status: 502 }
        );
      }

      convo.push({ role: "assistant", content: assistant.content });

      const toolCalls = assistant.tool_calls ?? [];
      if (!toolCalls.length) {
        break;
      }

      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        if (call.function.name === "retrieveMemories") {
          const args =
            safeJsonParse<{ limit?: number }>(call.function.arguments) ?? {};
          const memories = await retrieveMemories({
            ownerUserId: userId,
            limit: args.limit,
            contextMode: mode,
            subjectPatientUserId: mode === "physician" ? patientUserId : null,
          });
          convo.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ memories }),
          });
        } else if (call.function.name === "logMemory") {
          const args =
            safeJsonParse<{ memoryText: string; category?: string }>(
              call.function.arguments
            ) ?? null;
          if (!args?.memoryText) {
            convo.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: "MISSING_MEMORY_TEXT" }),
            });
            continue;
          }
          const mem = await proposeMemory({
            ownerUserId: userId,
            contextMode: mode,
            subjectPatientUserId: mode === "physician" ? patientUserId : null,
            memoryText: args.memoryText,
            category: args.category ?? null,
            sourceThreadId: threadId,
            sourceMessageId: userMsg?.id ?? null,
          });
          proposedMemories.push({
            id: mem.id,
            memoryText: mem.memoryText,
            category: mem.category,
          });
          convo.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ ok: true, memoryId: mem.id }),
          });
        } else if (call.function.name === "getDocumentInsights") {
            const args = safeJsonParse<{ documentId: string }>(call.function.arguments);
            if (!args?.documentId) {
                convo.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify({ error: "MISSING_DOCUMENT_ID" }),
                });
                continue;
            }
            
            // Check access again just to be safe, though context limited IDs usually.
            // But here the model can call with ANY ID. So we must verify access.
            const doc = await db.query.documents.findFirst({
                where: eq(documents.id, args.documentId)
            });
            
            if (!doc || doc.patientUserId !== patientUserId) {
                 convo.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify({ error: "DOCUMENT_NOT_FOUND_OR_ACCESS_DENIED" }),
                });
                continue;
            }

            const data = await getDocumentInsightsData(args.documentId);
            convo.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ 
                    filename: data?.document.originalFileName,
                    extracted: data?.extraction?.extractedJson,
                    ingested: data?.created
                }),
            });
        } else if (call.function.name === "proposePatientRecordSuggestion") {
            const args = safeJsonParse<{
                kind: "profile_update" | "vital" | "lab" | "medication" | "condition";
                summaryText: string;
                payloadJson: Record<string, unknown>;
            }>(call.function.arguments);

            if (!args?.kind || !args.summaryText || !args.payloadJson) {
                convo.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify({ error: "MISSING_ARGS" }),
                });
                continue;
            }

            try {
                const suggestion = await proposePatientRecordSuggestion({
                    patientUserId,
                    kind: args.kind,
                    summaryText: args.summaryText,
                    payloadJson: args.payloadJson,
                    sourceThreadId: threadId,
                    sourceMessageId: userMsg?.id ?? null,
                });
                proposedSuggestions.push({
                    id: suggestion.id,
                    kind: suggestion.kind,
                    summaryText: suggestion.summaryText
                });
                convo.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify({ ok: true, suggestionId: suggestion.id }),
                });
            } catch (e) {
                convo.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify({ error: "SUGGESTION_FAILED" }),
                });
            }
        } else {
          convo.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "UNKNOWN_TOOL" }),
          });
        }
      }
    }

    // Find the last assistant message with valid string content
    const assistantMessage = convo
      .slice()
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.trim()
      );

    const assistantContent =
      typeof assistantMessage?.content === "string"
        ? assistantMessage.content
        : null;

    const assistantText =
      assistantContent?.trim() ||
      "I'm not sure I understood—could you rephrase?";

    console.log(assistantText)

    const savedAssistant = await db
      .insert(chatMessages)
      .values({
        threadId,
        senderRole: "assistant",
        content: assistantText,
      })
      .returning()
      .then((rows) => rows[0]);

    // Update thread timestamp
    await db
      .update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(eq(chatThreads.id, threadId));

    return NextResponse.json({
      ok: true,
      threadId,
      message: savedAssistant,
      proposedMemories,
      proposedSuggestions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "DATABASE_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    if (
      error instanceof Error &&
      error.message === "FORBIDDEN_PATIENT_ACCESS"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("/api/chat POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
