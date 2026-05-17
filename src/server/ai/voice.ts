/**
 * Server-side helpers for STT (faster-whisper-server) and TTS (kokoro-fastapi).
 * Both services expose OpenAI-compatible endpoints.
 */

function getSttBase(): string {
  return process.env.STT_API_BASE ?? "http://whisper:8000";
}

function getTtsBase(): string {
  return process.env.TTS_API_BASE ?? "http://kokoro:8880";
}

/**
 * Transcribes audio to text via faster-whisper-server.
 * @param audioBuffer  Raw audio bytes (webm / ogg / mp4).
 * @param mimeType     MIME type of the audio, e.g. "audio/webm".
 * @returns            Transcribed text string.
 */
export async function sttTranscribe(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  // The OpenAI-compatible endpoint expects the field named "file"
  // new Uint8Array wraps the buffer view without copying for Blob compatibility
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  form.append("file", blob, "audio.webm");
  form.append("model", "whisper-1");

  const res = await fetch(`${getSttBase()}/v1/audio/transcriptions`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`STT error ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text ?? "";
}

/**
 * Converts text to speech via kokoro-fastapi.
 * @param text   Text to synthesise (caller should strip markdown first).
 * @param voice  Voice ID (defaults to TTS_VOICE env var or "af_bella").
 * @returns      ReadableStream of audio/mpeg bytes for streaming to client.
 */
export async function ttsSpeak(
  text: string,
  voice?: string
): Promise<ReadableStream<Uint8Array>> {
  const selectedVoice = voice ?? process.env.TTS_VOICE ?? "af_bella";

  const res = await fetch(`${getTtsBase()}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "kokoro", input: text, voice: selectedVoice }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`TTS error ${res.status}: ${detail}`);
  }

  if (!res.body) {
    throw new Error("TTS response has no body");
  }

  return res.body;
}
