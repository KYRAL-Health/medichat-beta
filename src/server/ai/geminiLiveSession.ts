import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage } from "@google/genai";

/**
 * Manages a single Gemini Live API session for one voice conversation.
 * Returns methods to send audio/text and a close handle.
 */

export interface LiveSessionCallbacks {
  onAudio?: (pcm16Base64: string) => void;
  onTurnComplete?: (transcript?: string) => void;
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
    systemInstruction: config.systemInstruction,
  };

  if (config.tools?.length) {
    connectConfig.tools = config.tools;
  }
  if (config.temperature != null) {
    connectConfig.temperature = config.temperature;
  }

  const session = await ai.live.connect({
    model: config.model,
    callbacks: {
      onopen: () => {
        console.log("[GeminiLive] Session opened");
      },
      onmessage: async (message: LiveServerMessage) => {
        // Audio data from model
        if (message.data) {
          callbacks.onAudio?.(message.data);
          return;
        }

        // Server content (text, turn complete, interrupted)
        if (message.serverContent) {
          const sc = message.serverContent;

          if (sc.interrupted) {
            callbacks.onInterrupted?.();
            return;
          }

          // Output transcription (text transcript of audio)
          const transcript = message.text ?? undefined;

          if (sc.turnComplete) {
            callbacks.onTurnComplete?.(transcript);
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
      const audioBuffer = Buffer.from(pcm16Base64, "base64");
      const blob = new Blob([audioBuffer], { type: "audio/pcm;rate=16000" });
      session.sendRealtimeInput({ media: blob as never });
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
