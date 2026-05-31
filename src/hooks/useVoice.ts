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
  /**
   * Called by ChatPanel when an `audio` SSE event arrives from /api/chat.
   * The server has already run TTS; `base64` is a base64-encoded MP3 frame.
   */
  receiveAudioChunk: (base64: string) => void;
  stopSpeaking: () => void;
  error: string | null;
}

export function useVoice({ onTranscript }: UseVoiceOptions): UseVoiceResult {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Web Audio API — one context for the lifetime of the component
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Client-side playback queue: decoded ArrayBuffers ready to play
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const stoppedRef = useRef(false);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => {
      const next = !v;
      if (next && !audioCtxRef.current) {
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
      setError(
        err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow mic access in your browser."
          : "Could not access microphone."
      );
      return;
    }

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
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Transcription failed");
        if (data.text?.trim()) onTranscript(data.text.trim());
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

  const stopCurrentAudio = useCallback(() => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch { /* already stopped */ }
      activeSourceRef.current = null;
    }
  }, []);

  /** Drains the audio queue, playing each frame sequentially. */
  const drainQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setStatus("speaking");

    // Ensure AudioContext exists and is running
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
      } catch {
        isPlayingRef.current = false;
        return;
      }
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    while (audioQueueRef.current.length > 0 && !stoppedRef.current) {
      const rawBuffer = audioQueueRef.current.shift()!;
      try {
        const audioBuffer = await ctx.decodeAudioData(rawBuffer);
        if (stoppedRef.current) break;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        activeSourceRef.current = source;

        await new Promise<void>((resolve) => {
          source.onended = () => { activeSourceRef.current = null; resolve(); };
          source.start(0);
        });
      } catch {
        // Decode/playback error for this frame — skip
      }
    }

    isPlayingRef.current = false;
    if (!stoppedRef.current) setStatus("idle");
  }, []);

  /**
   * Receives a base64-encoded MP3 frame from the server (via an `audio` SSE
   * event on /api/chat).  Decodes it to an ArrayBuffer and enqueues it for
   * sequential playback.
   */
  const receiveAudioChunk = useCallback((base64: string) => {
    if (stoppedRef.current) return;

    // atob → Uint8Array → ArrayBuffer
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    audioQueueRef.current.push(bytes.buffer as ArrayBuffer);
    stoppedRef.current = false;

    void drainQueue();
  }, [drainQueue]);

  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    stopCurrentAudio();
    setStatus("idle");
  }, [stopCurrentAudio]);

  return {
    voiceEnabled,
    toggleVoice,
    status,
    startRecording,
    stopRecording,
    receiveAudioChunk,
    stopSpeaking,
    error,
  };
}
