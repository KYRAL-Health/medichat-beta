/**
 * Server-side helpers for STT (Gemini Live API) and TTS (Gemini TTS API).
 */

import { GoogleGenAI, Modality } from "@google/genai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { PassThrough, Readable } from "stream";

ffmpeg.setFfmpegPath(ffmpegStatic ?? "ffmpeg");

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

// ─── Audio conversion: webm/ogg/mp4 → PCM 16kHz mono ───

function convertToPcm16kHz(inputBuffer: Buffer, mimeType: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputFormat = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "mp4"
      : undefined;

    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const outStream = new PassThrough();
    const chunks: Buffer[] = [];

    outStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    outStream.on("error", (err) => reject(err));

    const cmd = ffmpeg()
      .input(inputStream)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec("pcm_s16le")
      .format("s16le")
      .on("error", (err) => {
        reject(new Error(`ffmpeg conversion failed: ${err.message}`));
      })
      .on("end", () => {
        resolve(Buffer.concat(chunks));
      });

    if (inputFormat) {
      cmd.inputFormat(inputFormat);
    }

    cmd.pipe(outStream, { end: true });
  });
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

// ─── STT via Gemini Live API ───

/**
 * Transcribes audio to text via Gemini Live API.
 * @param audioBuffer  Raw audio bytes (webm / ogg / mp4).
 * @param mimeType     MIME type of the audio, e.g. "audio/webm".
 * @returns            Transcribed text string.
 */
export async function sttTranscribe(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const pcmBuffer = await convertToPcm16kHz(audioBuffer, mimeType);
  const ai = buildGenAI();

  const model = "gemini-3.1-flash-live-preview";
  const config = {
    responseModalities: [Modality.TEXT],
    inputAudioTranscription: {},
  };

  const messageQueue: Array<{ serverContent?: { inputTranscription?: { text?: string }; turnComplete?: boolean } }> = [];

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("STT timeout: no transcription received within 30s"));
    }, 30000);

    function handleMessage(
      msg: { serverContent?: { inputTranscription?: { text?: string }; turnComplete?: boolean } }
    ) {
      const transcription = msg.serverContent?.inputTranscription?.text;
      if (transcription != null) {
        clearTimeout(timeout);
        resolve(transcription);
        return;
      }
      if (msg.serverContent?.turnComplete) {
        clearTimeout(timeout);
        resolve("");
      }
    }

    void ai.live.connect({
      model,
      callbacks: {
        onopen: () => {
          /* no-op — send happens after session resolves */
        },
        onmessage: (msg) => {
          messageQueue.push(msg);
          handleMessage(msg);
        },
        onerror: (e) => {
          clearTimeout(timeout);
          reject(new Error(`Gemini Live API error: ${e.message}`));
        },
        onclose: () => {
          clearTimeout(timeout);
          // Resolve with empty if we get here without a transcription
          resolve("");
        },
      },
      config,
    }).then((session) => {
      // Send the PCM audio chunk
      const base64Audio = pcmBuffer.toString("base64");
      session.sendRealtimeInput({
        audio: { data: base64Audio, mimeType: "audio/pcm;rate=16000" },
      });
      // Signal end of audio stream
      session.sendRealtimeInput({ audioStreamEnd: true });
    }).catch((err) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Failed to connect to Gemini Live API: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    });
  });
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
