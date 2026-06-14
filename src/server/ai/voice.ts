/**
 * Server-side helpers for STT (Gemini multimodal API) and TTS (Gemini TTS API).
 */

import { GoogleGenAI, Modality } from "@google/genai";

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return key;
}

function getGeminiVoice(): string {
  return process.env.GEMINI_VOICE ?? "Kore";
}

function buildGenAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

// ─── WAV header writer ───

function pcmToWav(pcmBuffer: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataChunkSize = pcmBuffer.length;
  const fileSize = 36 + dataChunkSize;

  const header = Buffer.alloc(44);
  let offset = 0;

  header.write("RIFF", offset); offset += 4;
  header.writeUInt32LE(fileSize, offset); offset += 4;
  header.write("WAVE", offset); offset += 4;
  header.write("fmt ", offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4; // Subchunk1Size (PCM)
  header.writeUInt16LE(1, offset); offset += 2; // AudioFormat (PCM)
  header.writeUInt16LE(numChannels, offset); offset += 2;
  header.writeUInt32LE(sampleRate, offset); offset += 4;
  header.writeUInt32LE(byteRate, offset); offset += 4;
  header.writeUInt16LE(blockAlign, offset); offset += 2;
  header.writeUInt16LE(bitsPerSample, offset); offset += 2;
  header.write("data", offset); offset += 4;
  header.writeUInt32LE(dataChunkSize, offset); offset += 4;

  return Buffer.concat([header, pcmBuffer]);
}

// ─── STT via Gemini REST API ───

/**
 * Transcribes audio to text via Gemini multimodal API.
 * Sends the audio as inline data with a transcription prompt.
 * @param audioBuffer  Raw audio bytes (webm / ogg / mp4).
 * @param mimeType     MIME type of the audio, e.g. "audio/webm".
 * @returns            Transcribed text string.
 */
export async function sttTranscribe(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const ai = buildGenAI();
  const model = "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: audioBuffer.toString("base64"),
              mimeType,
            },
          },
          { text: "Transcribe this audio exactly as spoken. Return ONLY the transcribed text, nothing else." },
        ],
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ?? "";
}

// ─── TTS via Gemini REST API ───

/**
 * Converts text to speech via Gemini TTS REST API.
 * @param text   Text to synthesise (caller should strip markdown first).
 * @param voice  Voice name (defaults to GEMINI_VOICE env var or "Kore").
 * @returns      ReadableStream of audio/wav bytes for streaming to client.
 */
export async function ttsSpeak(
  text: string,
  voice?: string
): Promise<ReadableStream<Uint8Array>> {
  const selectedVoice = voice ?? getGeminiVoice();
  const ai = buildGenAI();
  const model = "gemini-3.1-flash-tts-preview";

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: selectedVoice },
        },
      },
    },
  });

  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];
  const base64Data = part?.inlineData?.data;

  if (!base64Data) {
    throw new Error("TTS response did not contain audio data");
  }

  const pcmBuffer = Buffer.from(base64Data, "base64");
  const wavBuffer = pcmToWav(pcmBuffer, 24000);

  // Convert Buffer to ReadableStream<Uint8Array>
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(wavBuffer));
      controller.close();
    },
  });
}
