import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage, Content } from "@google/genai";
import { sttTranscribe, pcmToWav } from "@/server/ai/voice";

/**
 * Manages a single Gemini Live API session for one voice conversation.
 * Returns methods to send audio/text and a close handle.
 */

export interface LiveSessionCallbacks {
  onAudio?: (pcm16Base64: string) => void;
  onTurnComplete?: (userTranscript?: string, assistantTranscript?: string) => void | Promise<void>;
  onInterrupted?: () => void;
  onToolCall?: (calls: Array<{ id: string; name: string; args: Record<string, unknown> }>) => Promise<void>;
  onError?: (err: Error) => void;
  onSetupComplete?: () => void;
}

export interface LiveSessionConfig {
  apiKey: string;
  model: string;
  systemInstruction: string;
  voice?: string;
  tools?: Array<{ functionDeclarations: unknown[] }>;
  temperature?: number;
}

export interface LiveSessionHandle {
  sendRealtimeInput(pcm16Base64: string): void;
  sendText(text: string): void;
  sendContext(turns: Content[]): void;
  sendToolResponse(functionResponses: Array<{ id?: string; name?: string; response?: Record<string, unknown> }>): void;
  close(): void;
}

export async function createGeminiLiveSession(
  config: LiveSessionConfig,
  callbacks: LiveSessionCallbacks
): Promise<LiveSessionHandle> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  const connectConfig: Record<string, unknown> = {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: config.voice ?? "Kore",
        },
      },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    systemInstruction: config.systemInstruction,
  };

  if (config.tools?.length) {
    connectConfig.tools = config.tools;
  }
  if (config.temperature != null) {
    connectConfig.temperature = config.temperature;
  }

  // Accumulate transcripts across streaming chunks within a turn
  let userTranscriptAcc = "";
  let assistantTranscriptAcc = "";
  // Accumulate PCM16 audio chunks for assistant speech transcription fallback
  const audioChunksAcc: Buffer[] = [];
  // Grace period timer for late outputTranscription after turnComplete
  let turnCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  // Resolved when the server sends setupComplete
  let resolveSetup: () => void;
  const setupReady = new Promise<void>((resolve) => { resolveSetup = resolve; });

  /** Finalize the current turn — transcribe fallback audio if needed, fire callback, reset state. */
  async function finalizeTurn(interrupted: boolean): Promise<void> {
    if (turnCompleteTimer) {
      clearTimeout(turnCompleteTimer);
      turnCompleteTimer = null;
    }

    const user = userTranscriptAcc.trim() || undefined;
    let assistant = assistantTranscriptAcc.trim() || undefined;

    // Fallback: transcribe accumulated audio if no transcript from API
    if (!assistant && audioChunksAcc.length > 0) {
      try {
        const pcmBuffer = Buffer.concat(audioChunksAcc);
        const wavBuffer = pcmToWav(pcmBuffer, 24000);
        assistant = await sttTranscribe(wavBuffer, "audio/wav");
        if (assistant) console.log("[GeminiLive] Transcribed assistant audio:", assistant.slice(0, 80));
      } catch (err) {
        console.error("[GeminiLive] Audio transcription fallback failed:", err);
      }
    }

    const label = interrupted ? "interrupted" : "turnComplete";
    console.log(`[GeminiLive] ${label} — user:`, user, "assistant:", assistant?.slice(0, 80));

    if (user || assistant) {
      await callbacks.onTurnComplete?.(user, assistant);
    }

    // Reset accumulators
    userTranscriptAcc = "";
    assistantTranscriptAcc = "";
    audioChunksAcc.length = 0;
  }

  const session = await ai.live.connect({
    model: config.model,
    callbacks: {
      onopen: () => {
        console.log("[GeminiLive] Session opened");
      },
      onmessage: async (message: LiveServerMessage) => {
        // ── Extract audio from modelTurn parts (canonical source) ──
        // message.data is a convenience getter that pulls from the same parts,
        // so we process modelTurn.parts directly and don't early-return.
        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              callbacks.onAudio?.(part.inlineData.data);
              audioChunksAcc.push(Buffer.from(part.inlineData.data, "base64"));
            }
            if (part.text) {
              assistantTranscriptAcc += part.text;
            }
          }
        }
        // Fallback: forward audio from message.data if no modelTurn parts found
        else if (message.data) {
          callbacks.onAudio?.(message.data);
          audioChunksAcc.push(Buffer.from(message.data, "base64"));
        }

        // ── Process serverContent (transcription + turn signals) ──
        if (message.serverContent) {
          const sc = message.serverContent;

          // Accumulate transcripts (independent of model turn ordering)
          if (sc.inputTranscription?.text) {
            userTranscriptAcc += sc.inputTranscription.text;
          }
          if (sc.outputTranscription?.text) {
            assistantTranscriptAcc += sc.outputTranscription.text;
          }

          // Interrupted — finalize partial turn, then notify client
          if (sc.interrupted) {
            await finalizeTurn(true);
            callbacks.onInterrupted?.();
            return;
          }

          // turnComplete — start grace period for late transcription chunks
          if (sc.turnComplete) {
            if (turnCompleteTimer) clearTimeout(turnCompleteTimer);
            turnCompleteTimer = setTimeout(() => {
              void finalizeTurn(false).catch((err) => {
                console.error("[GeminiLive] finalizeTurn failed:", err);
              });
            }, 500);
            return;
          }
          return;
        }

        // ── Tool calls ──
        if (message.toolCall?.functionCalls?.length) {
          const calls = message.toolCall.functionCalls.map((fc) => ({
            id: fc.id ?? "",
            name: fc.name ?? "",
            args: (fc.args ?? {}) as Record<string, unknown>,
          }));
          try {
            await callbacks.onToolCall?.(calls);
          } catch (err) {
            callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
          return;
        }

        // ── Setup complete ──
        if (message.setupComplete) {
          resolveSetup();
          callbacks.onSetupComplete?.();
          return;
        }
      },
      onerror: (e: ErrorEvent) => {
        console.error("[GeminiLive] Error:", e.message);
        callbacks.onError?.(new Error(e.message));
      },
      onclose: (e: CloseEvent) => {
        console.log("[GeminiLive] Session closed:", e.reason);
      },
    },
    config: connectConfig as never,
  });

  return {
    sendRealtimeInput(pcm16Base64: string) {
      session.sendRealtimeInput({
        audio: { data: pcm16Base64, mimeType: "audio/pcm;rate=16000" } as never,
      });
    },

    sendText(text: string) {
      session.sendClientContent({
        turns: text,
        turnComplete: true,
      });
    },

    sendContext(turns: Content[]) {
      if (!turns.length) return;
      // Wait for setupComplete before sending context to avoid losing messages
      void setupReady.then(() => {
        session.sendClientContent({
          turns,
          turnComplete: false,
        });
        console.log("[GeminiLive] Prefilled conversation context:", turns.length, "turns");
      });
    },

    sendToolResponse(functionResponses) {
      session.sendToolResponse({
        functionResponses: functionResponses.map((r) => ({
          id: r.id,
          name: r.name,
          response: r.response ?? {},
        })),
      });
    },

    close() {
      if (turnCompleteTimer) {
        clearTimeout(turnCompleteTimer);
        turnCompleteTimer = null;
      }
      session.close();
    },
  };
}
