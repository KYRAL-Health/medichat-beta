import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocketServer, type WebSocket } from "ws";
import { createHmac, timingSafeEqual } from "crypto";
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

// ─── Stateless HMAC tokens (avoids cross-module Map isolation) ───

const TOKEN_TTL_MS = 120_000; // 2 minutes

function getSecret(): string {
  return process.env.VOICE_TOKEN_SECRET ?? process.env.CLERK_SECRET_KEY ?? "medichat-voice-dev-secret";
}

function hmacSign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

interface TokenPayload {
  userId: string;
  mode: "patient" | "physician";
  patientUserId: string;
  exp: number;
}

/**
 * Creates a signed, stateless voice connection token.
 * No shared Map needed — verified purely by signature + expiry.
 */
export function createVoiceToken(userId: string, mode: "patient" | "physician", patientUserId: string): string {
  const payload: TokenPayload = { userId, mode, patientUserId, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmacSign(body);
  return `${body}.${sig}`;
}

function verifyVoiceToken(token: string): TokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmacSign(body);
  // Constant-time comparison
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
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

  const auth = verifyVoiceToken(token);
  if (!auth) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    (ws as unknown as Record<string, unknown>).__auth = auth;
    wss!.emit("connection", ws, req);
  });
}

// ─── Connection handler ───

async function handleConnection(ws: WebSocket): Promise<void> {
  const auth = (ws as unknown as Record<string, unknown>).__auth as TokenPayload | undefined;
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

  /** Ensure a thread exists, creating one if needed. Returns threadId. */
  async function ensureThread(): Promise<string> {
    if (threadId) return threadId;
    const thread = await db
      .insert(chatThreads)
      .values({
        patientUserId,
        createdByUserId: userId,
        contextMode: mode,
        title: mode === "patient" ? "Patient voice chat" : "Physician voice chat",
        updatedAt: new Date(),
      })
      .returning()
      .then((rows) => rows[0]);
    threadId = thread.id;
    // Tell the client about the new thread so it can update its UI
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "threadCreated", threadId: thread.id }));
    }
    return thread.id;
  }

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
          onTurnComplete: async (userText, assistantText) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: "turnComplete", userTranscript: userText, assistantTranscript: assistantText }));
            }

            // Persist each turn immediately
            if (userText || assistantText) {
              try {
                const tid = await ensureThread();
                if (userText) {
                  await db.insert(chatMessages).values({ threadId: tid, senderRole: "user", content: userText });
                }
                if (assistantText) {
                  await db.insert(chatMessages).values({ threadId: tid, senderRole: "assistant", content: assistantText });
                }
                await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, tid));
              } catch (err) {
                console.error("[VoiceProxy] Failed to persist turn:", err);
              }
            }
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

  ws.on("close", () => {
    console.log(`[VoiceProxy] User ${userId} disconnected`);
    session?.close();
    session = null;
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
  onTurnComplete: (userText?: string, assistantText?: string) => Promise<void>;
}

async function initializeSession(cfg: InitConfig): Promise<LiveSessionHandle> {
  const { userId, mode, patientUserId, documentIds, ws, onProposedMemories, onProposedSuggestions, onTurnComplete } = cfg;

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

  // Conversation history from existing thread
  let historyBlock = "";
  if (cfg.threadId) {
    try {
      const recentMessages = await db.query.chatMessages.findMany({
        where: eq(chatMessages.threadId, cfg.threadId),
        orderBy: (m, { desc }) => [desc(m.createdAt)],
        limit: 30,
      });
      if (recentMessages.length) {
        const chronological = [...recentMessages].reverse();
        const lines = chronological
          .filter((m) => m.senderRole === "user" || m.senderRole === "assistant")
          .map((m) => `${m.senderRole === "user" ? "Patient" : "Assistant"}: ${m.content}`);
        if (lines.length) {
          historyBlock = `\n\nConversation so far:\n${lines.join("\n")}`;
        }
      }
    } catch (err) {
      console.error("[VoiceProxy] Failed to load thread history:", err);
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
    historyBlock,
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
    historyBlock,
  ].join("\n");

  const systemInstruction = mode === "physician" ? physicianSystem : patientSystem;

  const geminiModel = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";
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
      onTurnComplete,
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
