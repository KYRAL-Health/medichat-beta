"use client";

import { useCallback, useRef, useState } from "react";

export type VoiceStatus = "idle" | "recording" | "transcribing" | "speaking";

interface UseVoiceOptions {
  /** Called with the transcribed text after recording stops. */
  onTranscript: (text: string) => void;
}

interface UseVoiceResult {
  voiceEnabled: boolean;
  toggleVoice: () => void;
  status: VoiceStatus;
  startRecording: () => void;
  stopRecording: () => void;
  speak: (text: string) => Promise<void>;
  error: string | null;
}

/** Strips common markdown syntax so TTS doesn't literally say "asterisk". */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "") // fenced code blocks
    .replace(/`[^`]*`/g, "")        // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/#{1,6}\s+/g, "")      // headings
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1") // bold/italic
    .replace(/^[-*+]\s+/gm, "")     // unordered list markers
    .replace(/^\d+\.\s+/gm, "")     // ordered list markers
    .replace(/>\s+/g, "")           // blockquotes
    .replace(/\n{2,}/g, "\n")       // collapse multiple newlines
    .trim();
}

export function useVoice({ onTranscript }: UseVoiceOptions): UseVoiceResult {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => !v);
    setError(null);
  }, []);

  const startRecording = useCallback(async () => {
    if (status !== "idle") return;
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow mic access in your browser.");
      } else {
        setError("Could not access microphone.");
      }
      return;
    }

    // Prefer audio/webm; fall back to audio/ogg; fall back to no constraint
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/ogg")
      ? "audio/ogg"
      : "";

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError("Recording is not supported in this browser.");
      return;
    }
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      setStatus("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Transcription failed");
        if (data.text?.trim()) {
          onTranscript(data.text.trim());
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Transcription failed");
      } finally {
        setStatus("idle");
      }
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setStatus("recording");
  }, [status, onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, [status]);

  // Holds the resolve fn of the active playback promise so interruption can settle it.
  const playbackResolveRef = useRef<(() => void) | null>(null);

  const speak = useCallback(async (text: string): Promise<void> => {
    // Interrupt any in-progress playback: settle its promise, revoke its URL, stop audio.
    if (currentAudioRef.current) {
      const prev = currentAudioRef.current;
      URL.revokeObjectURL(prev.src);
      prev.pause();
      currentAudioRef.current = null;
    }
    if (playbackResolveRef.current) {
      playbackResolveRef.current();
      playbackResolveRef.current = null;
    }

    const clean = stripMarkdown(text);
    if (!clean) return;

    // Truncate to avoid very long TTS on slow CPU inference
    const truncated = clean.length > 500 ? clean.slice(0, 500) + "…" : clean;

    setError(null);

    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: truncated }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "TTS failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      setStatus("speaking");

      await new Promise<void>((resolve) => {
        playbackResolveRef.current = resolve;
        audio.onended = () => { playbackResolveRef.current = null; resolve(); };
        audio.onerror = () => { playbackResolveRef.current = null; resolve(); };
        audio.play().catch(() => { playbackResolveRef.current = null; resolve(); });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback failed");
    } finally {
      if (currentAudioRef.current) {
        URL.revokeObjectURL(currentAudioRef.current.src);
        currentAudioRef.current = null;
      }
      playbackResolveRef.current = null;
      setStatus("idle");
    }
  }, []);

  return {
    voiceEnabled,
    toggleVoice,
    status,
    startRecording,
    stopRecording,
    speak,
    error,
  };
}
