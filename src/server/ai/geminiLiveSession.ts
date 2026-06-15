import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage } from "@google/genai";
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

  const session = await ai.live.connect({
    model: config.model,
    callbacks: {
      onopen: () => {
        console.log("[GeminiLive] Session opened");
      },
      onmessage: async (message: LiveServerMessage) => {
        // Audio data from model — accumulate for transcription
        if (message.data) {
          callbacks.onAudio?.(message.data);
          audioChunksAcc.push(Buffer.from(message.data, "base64"));
          return;
        }

        // Server content (text, turn complete, interrupted)
        if (message.serverContent) {
          const sc = message.serverContent;

          // Accumulate transcripts BEFORE checking interrupted —
          // inputTranscription can arrive in the same message as interrupted
          if (sc.inputTranscription?.text) {
            userTranscriptAcc += sc.inputTranscription.text;
          }
          if (sc.outputTranscription?.text) {
            assistantTranscriptAcc += sc.outputTranscription.text;
          }
          if (sc.modelTurn?.parts) {
            for (const part of sc.modelTurn.parts) {
              if (part.text) {
                assistantTranscriptAcc += part.text;
              }
            }
          }

          if (sc.interrupted) {
            callbacks.onInterrupted?.();
            return;
          }

          if (sc.turnComplete) {
            const user = userTranscriptAcc.trim() || undefined;
            let assistant = assistantTranscriptAcc.trim() || undefined;

            // If no transcript from the API, transcribe the accumulated audio
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

            console.log("[GeminiLive] turnComplete — user:", user, "assistant:", assistant?.slice(0, 80));
            await callbacks.onTurnComplete?.(user, assistant);
            userTranscriptAcc = "";
            assistantTranscriptAcc = "";
            audioChunksAcc.length = 0;
          }
          return;
        }

        // Tool calls
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

        // Setup complete
        if (message.setupComplete) {
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
      session.close();
    },
  };
}
