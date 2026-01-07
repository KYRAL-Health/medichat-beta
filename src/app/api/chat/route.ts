import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import {
  chatCompletion,
  getChatModel,
  type AiTool,
  type ChatMessage,
} from "@/server/ai";
import { proposeMemory, retrieveMemories } from "@/server/ai/tools";
import { proposePatientRecordSuggestion } from "@/server/ai/patientTools";
import { db } from "@/server/db";
import { chatMessages, chatThreads, documents } from "@/server/db/schema";
import {
  buildPatientContext,
  stringifyPatientContext,
} from "@/server/patients/context";
import { getDocumentInsightsData } from "@/server/documents/insights";

export const runtime = "nodejs";

const ChatSchema = z.object({
  mode: z.enum(["patient", "physician"]),
  patientUserId: z.string().uuid().optional(),
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

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
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
      mode === "patient" ? user.id : parsed.data.patientUserId ?? null;

    if (!patientUserId) {
      return NextResponse.json(
        { error: "Missing patientUserId" },
        { status: 400 }
      );
    }

    if (mode === "physician") {
      await assertPatientAccess({ viewerUserId: user.id, patientUserId });
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
          createdByUserId: user.id,
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

    const patientSystem = [
      "You are MediChat, a medical AI assistant speaking directly to the patient.",
      "Favour shorter responses that prompt engagement from the user.",
      "Be concise, empathetic, and structured. If symptoms suggest an emergency, advise seeking urgent care.",
      "Ground your response in PatientContext when available, and ask clarifying questions when needed.",
      "Do not provide medical advice; provide informational guidance and encourage clinician review where appropriate.",
      "Personalization:",
      "- Use retrieveMemories to fetch accepted memories for the current user (patient context only).",
      "- If you learn something stable/useful (health history, preferences, goals), you MAY call logMemory to propose remembering it.",
      "- If you learn a concrete fact suitable for the medical record (meds, vitals, diagnosis, or profile change), call proposePatientRecordSuggestion.",
      "- Only propose memories that are clear, specific, and likely to remain true.",
      "",
      patientCtxText,
      docContext,
    ].join("\n");

    const physicianSystem = [
      "You are MediChat, a medical AI assistant speaking to a clinician (physician view).",
      "Respond in a clinician-friendly, highly structured way:",
      "- Brief summary",
      "- Key risks / red flags to watch",
      "- Most useful clarifying questions",
      "- Suggested next evaluations (informational; encourage clinician judgment)",
      "Be concise and avoid fluff.",
      "Ground your response in PatientContext when available; do not hallucinate missing data.",
      "Do not provide medical advice; provide informational suggestions and encourage clinician review where appropriate.",
      "Personalization:",
      "- Use retrieveMemories to fetch accepted memories for the clinician, scoped to this patient and physician mode.",
      "- You MAY call logMemory to propose remembering stable patient-specific context for this clinician (e.g., 'Patient reports X baseline').",
      "- If you identify a concrete update for the medical record, call proposePatientRecordSuggestion.",
      "- Only propose memories that are clear, specific, and likely to remain true.",
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
            ownerUserId: user.id,
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
            ownerUserId: user.id,
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
                    name: call.function.name,
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
                    name: call.function.name,
                    content: JSON.stringify({ error: "DOCUMENT_NOT_FOUND_OR_ACCESS_DENIED" }),
                });
                continue;
            }

            const data = await getDocumentInsightsData(args.documentId);
            convo.push({
                role: "tool",
                tool_call_id: call.id,
                name: call.function.name,
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
                    name: call.function.name,
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
                    name: call.function.name,
                    content: JSON.stringify({ ok: true, suggestionId: suggestion.id }),
                });
            } catch (e) {
                convo.push({
                    role: "tool",
                    tool_call_id: call.id,
                    name: call.function.name,
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
