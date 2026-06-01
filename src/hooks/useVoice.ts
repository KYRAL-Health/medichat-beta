"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus = "idle" | "recording" | "transcribing" | "speaking" | "listening";

interface UseVoiceOptions {
  /** Called with the transcribed text after recording stops. */
  onTranscript: (text: string) => void;
  /** Fires when user speaks during TTS (barge-in). */
  onBargeIn?: () => void;
}

interface UseVoiceResult {
  voiceEnabled: boolean;
  toggleVoice: () => void;
  conversationMode: boolean;
  toggleConversationMode: () => void;
  status: VoiceStatus;
  startRecording: () => void;
  stopRecording: () => void;
  receiveAudioChunk: (base64: string) => void;
  stopSpeaking: () => void;
  resetPlayback: () => void;
  error: string | null;
}

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 1500;
const POLL_INTERVAL_MS = 100;

export function useVoice({ onTranscript, onBargeIn }: UseVoiceOptions): UseVoiceResult {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const stoppedRef = useRef(false);

  // Conversation mode refs
  const conversationStreamRef = useRef<MediaStream | null>(null);
  const conversationAnalyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef(0);
  const conversationAudioCtxRef = useRef<AudioContext | null>(null);
  const conversationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationActiveRef = useRef(false);

  // Keep refs accessible in poll callback without stale closures
  const statusRef = useRef(status);
  statusRef.current = status;

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onBargeInRef = useRef(onBargeIn);
  onBargeInRef.current = onBargeIn;

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

  // Cleanup on unmount
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
      // Conversation cleanup
      if (conversationPollRef.current) clearInterval(conversationPollRef.current);
      if (conversationStreamRef.current) {
        conversationStreamRef.current.getTracks().forEach((t) => t.stop());
        conversationStreamRef.current = null;
      }
      if (conversationAudioCtxRef.current) {
        void conversationAudioCtxRef.current.close();
        conversationAudioCtxRef.current = null;
      }
      conversationActiveRef.current = false;
    };
  }, []);

  // ─── Conversation mode: startRecording with shared stream ───
  const startRecordingWithStream = useCallback(async (sharedStream: MediaStream) => {
    const currentStatus = statusRef.current;
    if (currentStatus !== "idle" && currentStatus !== "listening") return;
    setError(null);
    stoppedRef.current = false;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/ogg")
      ? "audio/ogg"
      : "";

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(sharedStream, mimeType ? { mimeType } : undefined);
    } catch {
      setError("Recording is not supported in this browser.");
      return;
    }
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Don't stop shared stream tracks — they're reused
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      setStatus("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Transcription failed");
        if (data.text?.trim()) onTranscriptRef.current(data.text.trim());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Transcription failed");
      } finally {
        if (conversationActiveRef.current) {
          setStatus("listening");
        } else {
          setStatus("idle");
        }
      }
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setStatus("recording");
  }, []);

  // ─── Conversation mode: poll for silence / speech ───
  const pollConversation = useCallback(() => {
    const analyser = conversationAnalyserRef.current;
    if (!analyser) return;

    const fftSize = analyser.fftSize;
    const data = new Float32Array(fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const isSpeaking = rms > SILENCE_THRESHOLD;

    const currentStatus = statusRef.current;
    const stream = conversationStreamRef.current;

    if (currentStatus === "listening" && isSpeaking && stream) {
      silenceTimerRef.current = 0;
      void startRecordingWithStream(stream);
    } else if (currentStatus === "recording" && !isSpeaking) {
      silenceTimerRef.current += POLL_INTERVAL_MS;
      if (silenceTimerRef.current >= SILENCE_DURATION_MS) {
        silenceTimerRef.current = 0;
        if (mediaRecorderRef.current && statusRef.current === "recording") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
      }
    } else if (currentStatus === "speaking" && isSpeaking && stream) {
      // Barge-in
      stoppedRef.current = true;
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch { /* already stopped */ }
        activeSourceRef.current = null;
      }
      onBargeInRef.current?.();
      silenceTimerRef.current = 0;
      // Update statusRef synchronously — setStatus is async (React state)
      // but startRecordingWithStream checks statusRef.current immediately
      statusRef.current = "idle";
      void startRecordingWithStream(stream);
    } else {
      silenceTimerRef.current = 0;
    }
  }, [startRecordingWithStream]);

  const toggleConversationMode = useCallback(() => {
    setConversationMode((prev) => {
      const next = !prev;

      if (next) {
        // Turning ON
        setVoiceEnabled(true);
        conversationActiveRef.current = true;
        stoppedRef.current = false;

        // Get persistent stream
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          conversationStreamRef.current = stream;

          // Separate AudioContext for analyser (avoids decodeAudioData conflicts)
          try {
            const actx = new (
              window.AudioContext ??
              (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            )();
            conversationAudioCtxRef.current = actx;
            const source = actx.createMediaStreamSource(stream);
            const analyser = actx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            conversationAnalyserRef.current = analyser;

            // Start polling
            conversationPollRef.current = setInterval(pollConversation, POLL_INTERVAL_MS);
            setStatus("listening");
          } catch {
            setError("Could not start conversation mode.");
          }
        }).catch(() => {
          setError("Microphone access required for conversation mode.");
          conversationActiveRef.current = false;
          setConversationMode(false);
        });
      } else {
        // Turning OFF
        conversationActiveRef.current = false;
        if (conversationPollRef.current) {
          clearInterval(conversationPollRef.current);
          conversationPollRef.current = null;
        }
        if (conversationStreamRef.current) {
          conversationStreamRef.current.getTracks().forEach((t) => t.stop());
          conversationStreamRef.current = null;
        }
        if (conversationAudioCtxRef.current) {
          void conversationAudioCtxRef.current.close();
          conversationAudioCtxRef.current = null;
        }
        conversationAnalyserRef.current = null;
        silenceTimerRef.current = 0;
        // Stop any in-flight recording
        if (mediaRecorderRef.current && statusRef.current === "recording") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
        setStatus("idle");
      }

      return next;
    });
  }, [pollConversation]);

  // ─── Original push-to-talk recording ───
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

  const drainQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setStatus("speaking");

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
    if (!stoppedRef.current) {
      if (conversationActiveRef.current) {
        setStatus("listening");
      } else {
        setStatus("idle");
      }
    }
  }, []);

  const receiveAudioChunk = useCallback((base64: string) => {
    if (stoppedRef.current) return;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    audioQueueRef.current.push(bytes.buffer as ArrayBuffer);

    void drainQueue();
  }, [drainQueue]);

  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    stopCurrentAudio();
    if (conversationActiveRef.current) {
      setStatus("listening");
      statusRef.current = "listening";
    } else {
      setStatus("idle");
    }
  }, [stopCurrentAudio]);

  const resetPlayback = useCallback(() => {
    stoppedRef.current = false;
  }, []);

  return {
    voiceEnabled,
    toggleVoice,
    conversationMode,
    toggleConversationMode,
    status,
    startRecording,
    stopRecording,
    receiveAudioChunk,
    stopSpeaking,
    resetPlayback,
    error,
  };
}
