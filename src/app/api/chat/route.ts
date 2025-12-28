import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import {
  openRouterChatCompletion,
  type OpenRouterTool,
} from "@/server/ai/openrouter";
import { proposeMemory, retrieveMemories } from "@/server/ai/tools";
import { db } from "@/server/db";
import { chatMessages, chatThreads } from "@/server/db/schema";
import {
  buildPatientContext,
  stringifyPatientContext,
} from "@/server/patients/context";

export const runtime = "nodejs";

const ChatSchema = z.object({
  mode: z.enum(["patient", "physician"]),
  patientUserId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
});

function getChatModel() {
  return process.env.OPENROUTER_MODEL_CHAT ?? "openai/gpt-4o";
}

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

    const { mode, message } = parsed.data;
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
      "- Only propose memories that are clear, specific, and likely to remain true.",
      "",
      patientCtxText,
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
      "- Only propose memories that are clear, specific, and likely to remain true.",
      "",
      patientCtxText,
    ].join("\n");

    const tools: OpenRouterTool[] = [
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
    ];

    const system = mode === "physician" ? physicianSystem : patientSystem;

    let convo: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string | null;
      name?: string;
      tool_call_id?: string;
    }> = [{ role: "system", content: system }];

    for (const m of chronological) {
      // For now, filter out tool messages because we don't store tool_calls JSON
      // in the DB, so we can't reconstruct the valid tool call chain required by OpenRouter.
      // This is a tradeoff: we lose some history of *what* happened in tools, but
      // we keep the chat functional.
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

    // Tool loop (max 3 iterations)
    for (let i = 0; i < 3; i++) {
      const resp = await openRouterChatCompletion({
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
            name: call.function.name,
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
              name: call.function.name,
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
            name: call.function.name,
            content: JSON.stringify({ ok: true, memoryId: mem.id }),
          });
        } else {
          convo.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify({ error: "UNKNOWN_TOOL" }),
          });
        }
      }
    }

    const assistantFinal = convo
      .slice()
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.trim()
      )?.content;

    const assistantText =
      assistantFinal ?? "I’m not sure I understood—could you rephrase?";

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
