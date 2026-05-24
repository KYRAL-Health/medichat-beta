"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  speakStream: (sentence: string) => void;
  stopSpeaking: () => void;
  error: string | null;
}

/** Strips common markdown syntax so TTS doesn't literally say "asterisk". */
function stripMarkdown(md: string): string {
  return md
    // Drop References / Key Studies section and everything after it
    .replace(/\n#+\s*(References|Key Studies)\b[\s\S]*/i, "")
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

  // Web Audio API — single context reused across all sentences
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Sentence queue for streaming TTS
  const sentenceQueueRef = useRef<string[]>([]);
  const isPlayingQueueRef = useRef(false);
  const stoppedRef = useRef(false);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => {
      const next = !v;
      if (next && !audioCtxRef.current) {
        // Create AudioContext on the first user gesture that enables voice.
        // This unlocks audio playback for all subsequent sentences.
        try {
          audioCtxRef.current = new (
            window.AudioContext ??
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          )();
        } catch {
          // AudioContext not supported — fall back gracefully
        }
      }
      return next;
    });
    setError(null);
  }, []);

  // Close AudioContext on unmount to avoid hitting the browser's instance limit
  useEffect(() => {
    return () => {
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch { /* already stopped */ }
        activeSourceRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
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

  /** Stops the active Web Audio source node and resets playback state. */
  const stopCurrentAudio = useCallback(() => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch { /* already stopped */ }
      activeSourceRef.current = null;
    }
  }, []);

  /** Drain the queue and stop any active playback immediately. */
  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true;
    sentenceQueueRef.current = [];
    isPlayingQueueRef.current = false;
    stopCurrentAudio();
    setStatus("idle");
  }, [stopCurrentAudio]);

  /**
   * Fetches TTS audio for `text`, fully decodes it, then plays it via
   * Web Audio API. Returns once playback ends (or is interrupted).
   *
   * Using Web Audio API instead of HTML5 <audio> avoids two problems:
   *  1. Silent skips — AudioContext stays unlocked; no autoplay rejections.
   *  2. Soft first words — audio is fully decoded before the first sample
   *     hits hardware, so playback starts at full amplitude.
   */
  const playSentence = useCallback(async (text: string): Promise<void> => {
    const clean = stripMarkdown(text);
    if (!clean) return;

    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "TTS failed");
      }

      // Check stop flag after async fetch — avoid playing a cancelled sentence
      if (stoppedRef.current) return;

      const arrayBuffer = await res.arrayBuffer();
      if (stoppedRef.current) return;

      // Ensure AudioContext exists and is running
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      if (stoppedRef.current) return;

      // Fully decode before playing — eliminates the soft-start ramp
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (stoppedRef.current) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      activeSourceRef.current = source;

      await new Promise<void>((resolve) => {
        source.onended = () => { activeSourceRef.current = null; resolve(); };
        source.start(0);
      });
    } catch {
      // Non-fatal — TTS errors don't break chat
    }
  }, []);

  /**
   * Drains the sentence queue sequentially.
   * Exits early if `stoppedRef` is set.
   */
  const drainQueue = useCallback(async () => {
    if (isPlayingQueueRef.current) return;
    isPlayingQueueRef.current = true;
    setStatus("speaking");

    while (sentenceQueueRef.current.length > 0 && !stoppedRef.current) {
      const sentence = sentenceQueueRef.current.shift()!;
      await playSentence(sentence);
    }

    isPlayingQueueRef.current = false;
    if (!stoppedRef.current) setStatus("idle");
  }, [playSentence]);

  /**
   * Enqueues a sentence for sequential TTS playback.
   * Starts draining the queue if not already playing.
   * Called with each sentence as streaming text arrives.
   */
  const speakStream = useCallback((sentence: string) => {
    const clean = stripMarkdown(sentence);
    if (!clean) return;
    stoppedRef.current = false;
    sentenceQueueRef.current.push(clean);
    void drainQueue();
  }, [drainQueue]);

  /**
   * Speaks a full text string (used for non-streaming contexts or replays).
   * Splits into sentences and queues them.
   */
  const speak = useCallback(async (text: string): Promise<void> => {
    stopSpeaking(); // interrupt any active playback
    const clean = stripMarkdown(text);
    if (!clean) return;

    // Truncate to avoid very long TTS on slow CPU inference
    const truncated = clean.length > 500 ? clean.slice(0, 500) + "…" : clean;
    setError(null);
    stoppedRef.current = false;

    // Split into sentences and queue them
    const sentences = truncated.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const s of sentences) sentenceQueueRef.current.push(s);

    await drainQueue();
  }, [stopSpeaking, drainQueue]);

  return {
    voiceEnabled,
    toggleVoice,
    status,
    startRecording,
    stopRecording,
    speak,
    speakStream,
    stopSpeaking,
    error,
  };
}
