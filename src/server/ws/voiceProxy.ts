import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocketServer, type WebSocket } from "ws";
import { randomUUID } from "crypto";
import { parse as parseUrl } from "url";

import { createGeminiLiveSession, type LiveSessionHandle } from "@/server/ai/geminiLiveSession";
import { liveFunctionDeclarations } from "@/server/ai/geminiLiveTools";
import { retrieveMemories, proposeMemory } from "@/server/ai/tools";
import { getDocumentInsightsData } from "@/server/documents/insights";
import { proposePatientRecordSuggestion } from "@/server/ai/patientTools";
import { buildPatientContext, stringifyPatientContext } from "@/server/patients/context";
import { db } from "@/server/db";
import { chatMessages, chatThreads, documents } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";

// ─── Token store for pre-authenticated connections ───
interface PendingConnection {
  userId: string;
  mode: "patient" | "physician";
  patientUserId: string;
  createdAt: number;
}

const pendingConnections = new Map<string, PendingConnection>();
const TOKEN_TTL_MS = 30_000; // 30 seconds

/**
 * Called by the /api/voice/live/init route to pre-register a connection token.
 * Returns the token that the client should pass as ?token=... on the WS URL.
 */
export function createVoiceToken(userId: string, mode: "patient" | "physician", patientUserId: string): string {
  const token = randomUUID();
  pendingConnections.set(token, { userId, mode, patientUserId, createdAt: Date.now() });
  // Auto-expire
  setTimeout(() => pendingConnections.delete(token), TOKEN_TTL_MS);
  return token;
}

// ─── WebSocket upgrade handler ───

let wss: WebSocketServer | null = null;

export function handleVoiceUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    wss.on("connection", (ws) => void handleConnection(ws));
  }

  const parsed = parseUrl(req.url ?? "", true);
  const token = (parsed.query.token as string) ?? "";

  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const pending = pendingConnections.get(token);
  if (!pending) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  pendingConnections.delete(token);

  wss.handleUpgrade(req, socket, head, (ws) => {
    // Attach auth info to the ws object for handleConnection
    (ws as unknown as Record<string, unknown>).__auth = pending;
    wss!.emit("connection", ws, req);
  });
}

// ─── Connection handler ───

async function handleConnection(ws: WebSocket): Promise<void> {
  const auth = (ws as unknown as Record<string, unknown>).__auth as PendingConnection | undefined;
  if (!auth) {
    ws.close(4001, "Unauthorized");
    return;
  }

  const { userId, mode, patientUserId } = auth;
  console.log(`[VoiceProxy] User ${userId} connected (mode=${mode})`);

  let session: LiveSessionHandle | null = null;
  let threadId: string | null = null;
  let configReceived = false;
  const proposedMemories: Array<{ id: string; memoryText: string; category: string | null }> = [];
  const proposedSuggestions: Array<{ id: string; kind: string; summaryText: string }> = [];

  // Buffer for assistant text transcript (for thread persistence)
  // eslint-disable-next-line prefer-const
  let assistantTranscript = "";
  let userMessageBuffer = "";

  ws.on("message", async (data, isBinary) => {
    // Binary = audio PCM16 from client mic
    if (isBinary && session) {
      const base64 = Buffer.from(data as Buffer).toString("base64");
      session.sendRealtimeInput(base64);
      return;
    }

    // JSON control messages
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data.toString()) as Record<string, unknown>;
    } catch {
      return;
    }

    // ─── Initial config message ───
    if (!configReceived && msg.type === "config") {
      configReceived = true;
      threadId = (msg.threadId as string) ?? null;
      const documentIds = (msg.documentIds as string[]) ?? [];

      try {
        session = await initializeSession({
          userId,
          mode,
          patientUserId,
          threadId,
          documentIds,
          ws,
          onProposedMemories: (m) => {
            proposedMemories.push(...m);
            ws.send(JSON.stringify({ type: "proposedMemories", memories: m }));
          },
          onProposedSuggestions: (s) => {
            proposedSuggestions.push(...s);
            ws.send(JSON.stringify({ type: "proposedSuggestions", suggestions: s }));
          },
        });
        ws.send(JSON.stringify({ type: "ready" }));
      } catch (err) {
        console.error("[VoiceProxy] Session init failed:", err);
        ws.send(JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "Session init failed" }));
        ws.close(4002, "Session init failed");
      }
      return;
    }

    // ─── Text input (typed while in voice mode) ───
    if (msg.type === "text" && typeof msg.text === "string" && session) {
      userMessageBuffer = msg.text;
      session.sendText(msg.text);
      return;
    }

    // ─── Client signals end of audio stream ───
    if (msg.type === "audioEnd" && session) {
      // The Gemini Live API uses VAD to detect end of speech automatically.
      // This message is informational — we can use it for logging.
      return;
    }
  });

  ws.on("close", async () => {
    console.log(`[VoiceProxy] User ${userId} disconnected`);
    session?.close();
    session = null;

    // Persist transcript to thread
    if (threadId && (userMessageBuffer || assistantTranscript)) {
      try {
        if (userMessageBuffer) {
          await db.insert(chatMessages).values({
            threadId,
            senderRole: "user",
            content: userMessageBuffer,
          });
        }
        if (assistantTranscript) {
          await db.insert(chatMessages).values({
            threadId,
            senderRole: "assistant",
            content: assistantTranscript,
          });
        }
        await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
      } catch (err) {
        console.error("[VoiceProxy] Failed to persist transcript:", err);
      }
    }
  });

  ws.on("error", (err) => {
    console.error("[VoiceProxy] WebSocket error:", err);
    session?.close();
  });
}

// ─── Session initialization ───

interface InitConfig {
  userId: string;
  mode: "patient" | "physician";
  patientUserId: string;
  threadId: string | null;
  documentIds: string[];
  ws: WebSocket;
  onProposedMemories: (m: Array<{ id: string; memoryText: string; category: string | null }>) => void;
  onProposedSuggestions: (s: Array<{ id: string; kind: string; summaryText: string }>) => void;
}

async function initializeSession(cfg: InitConfig): Promise<LiveSessionHandle> {
  const { userId, mode, patientUserId, documentIds, ws, onProposedMemories, onProposedSuggestions } = cfg;

  // Build system prompt (same logic as /api/chat)
  const patientCtx = await buildPatientContext(patientUserId);
  const patientCtxText = stringifyPatientContext(patientCtx);

  // Document context
  let docContext = "";
  if (documentIds.length) {
    const docs = await db.query.documents.findMany({
      where: inArray(documents.id, documentIds),
    });
    const validDocs = docs.filter((d) => d.patientUserId === patientUserId);
    if (validDocs.length) {
      docContext = `\n\nThe user has attached the following documents to this message:\n${validDocs.map((d) => `- ${d.originalFileName} (ID: ${d.id})`).join("\n")}\nYou can use the 'getDocumentInsights' tool to read their contents.`;
    }
  }

  // PubMed classification (on initial connection — no message yet, so skip)
  // PubMed will be handled if the user sends text via sendText.

  const patientSystem = [
    "You are MediChat, a medical AI assistant speaking directly to the patient.",
    "Be empathetic, clear, and structured.",
    "If symptoms suggest an emergency, advise seeking urgent care.",
    "Ground your response in PatientContext when available.",
    "Ask clarifying questions when appropriate.",
    "Do not provide medical advice; provide informational guidance and encourage clinician review where appropriate.",
    "",
    "Response Style Rules:",
    "- Keep explanations clear and patient-friendly.",
    "- When citations are required, completeness takes priority over brevity.",
    "- Do NOT omit required structural sections for the sake of conciseness.",
    "",
    "Personalization:",
    "- Use retrieveMemories to fetch accepted memories for the current user (patient context only).",
    "- You MAY call logMemory to propose remembering stable health history.",
    "- If you identify a concrete medical record update, call proposePatientRecordSuggestion.",
    "- Only propose memories that are clear and likely to remain true.",
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
    "",
    "Be precise and clinically concise.",
    "Ground your response in PatientContext; do not hallucinate missing data.",
    "Do not provide medical advice; provide informational suggestions and encourage clinician judgment.",
    "",
    "Personalization:",
    "- Use retrieveMemories scoped to this patient and physician mode.",
    "- You MAY log stable patient-specific baseline context.",
    "- Propose concrete medical record updates when appropriate.",
    "- Only propose stable, specific facts.",
    "",
    patientCtxText,
    docContext,
  ].join("\n");

  const systemInstruction = mode === "physician" ? physicianSystem : patientSystem;

  const geminiModel = process.env.GEMINI_LIVE_MODEL ?? "gemini-2.0-flash-live-001";
  const geminiVoice = process.env.GEMINI_VOICE ?? "Kore";

  const session = await createGeminiLiveSession(
    {
      apiKey: process.env.GEMINI_API_KEY!,
      model: geminiModel,
      systemInstruction,
      voice: geminiVoice,
      tools: [{ functionDeclarations: liveFunctionDeclarations }],
      temperature: 0.4,
    },
    {
      onAudio: (pcm16Base64) => {
        // Forward Gemini audio to client as binary
        if (ws.readyState === ws.OPEN) {
          const buf = Buffer.from(pcm16Base64, "base64");
          ws.send(buf, { binary: true });
        }
      },
      onTurnComplete: (transcript) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "turnComplete", transcript }));
        }
      },
      onInterrupted: () => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "interrupted" }));
        }
      },
      onToolCall: async (calls) => {
        const functionResponses = [];

        for (const call of calls) {
          let result: Record<string, unknown>;

          try {
            result = await executeTool(call.name, call.args, {
              userId,
              mode,
              patientUserId,
              threadId: cfg.threadId,
              onProposedMemories,
              onProposedSuggestions,
            });
          } catch (err) {
            result = { error: err instanceof Error ? err.message : "Tool execution failed" };
          }

          functionResponses.push({
            id: call.id,
            name: call.name,
            response: result,
          });
        }

        session.sendToolResponse(functionResponses);
      },
      onError: (err) => {
        console.error("[VoiceProxy] Gemini error:", err);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "error", error: err.message }));
        }
      },
    }
  );

  return session;
}

// ─── Tool execution ───

interface ToolExecContext {
  userId: string;
  mode: "patient" | "physician";
  patientUserId: string;
  threadId: string | null;
  onProposedMemories: (m: Array<{ id: string; memoryText: string; category: string | null }>) => void;
  onProposedSuggestions: (s: Array<{ id: string; kind: string; summaryText: string }>) => void;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case "retrieveMemories": {
      const memories = await retrieveMemories({
        ownerUserId: ctx.userId,
        limit: (args.limit as number) ?? undefined,
        contextMode: ctx.mode,
        subjectPatientUserId: ctx.mode === "physician" ? ctx.patientUserId : null,
      });
      return { memories };
    }

    case "logMemory": {
      const memoryText = args.memoryText as string;
      if (!memoryText) return { error: "MISSING_MEMORY_TEXT" };
      const mem = await proposeMemory({
        ownerUserId: ctx.userId,
        contextMode: ctx.mode,
        subjectPatientUserId: ctx.mode === "physician" ? ctx.patientUserId : null,
        memoryText,
        category: (args.category as string) ?? null,
        sourceThreadId: ctx.threadId,
        sourceMessageId: null,
      });
      ctx.onProposedMemories([{ id: mem.id, memoryText: mem.memoryText, category: mem.category }]);
      return { ok: true, memoryId: mem.id };
    }

    case "getDocumentInsights": {
      const documentId = args.documentId as string;
      if (!documentId) return { error: "MISSING_DOCUMENT_ID" };
      const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
      if (!doc || doc.patientUserId !== ctx.patientUserId) {
        return { error: "DOCUMENT_NOT_FOUND_OR_ACCESS_DENIED" };
      }
      const data = await getDocumentInsightsData(documentId);
      return {
        filename: data?.document.originalFileName,
        extracted: data?.extraction?.extractedJson,
        ingested: data?.created,
      };
    }

    case "proposePatientRecordSuggestion": {
      const kind = args.kind as string;
      const summaryText = args.summaryText as string;
      const payloadJson = args.payloadJson as Record<string, unknown>;
      if (!kind || !summaryText || !payloadJson) return { error: "MISSING_ARGS" };
      try {
        const suggestion = await proposePatientRecordSuggestion({
          patientUserId: ctx.patientUserId,
          kind: kind as "profile_update" | "vital" | "lab" | "medication" | "condition",
          summaryText,
          payloadJson,
          sourceThreadId: ctx.threadId!,
          sourceMessageId: null,
        });
        ctx.onProposedSuggestions([{ id: suggestion.id, kind: suggestion.kind, summaryText: suggestion.summaryText }]);
        return { ok: true, suggestionId: suggestion.id };
      } catch {
        return { error: "SUGGESTION_FAILED" };
      }
    }

    default:
      return { error: "UNKNOWN_TOOL" };
  }
}
