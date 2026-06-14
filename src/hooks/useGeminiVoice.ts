"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus = "idle" | "connecting" | "recording" | "listening" | "speaking" | "transcribing";

export interface ProposedMemory {
  id: string;
  memoryText: string;
  category: string | null;
}

export interface ProposedSuggestion {
  id: string;
  kind: string;
  summaryText: string;
}

interface UseGeminiVoiceOptions {
  mode: "patient" | "physician";
  patientUserId?: string;
  onTranscript?: (text: string) => void;
  onBargeIn?: () => void;
  onProposedMemories?: (memories: ProposedMemory[]) => void;
  onProposedSuggestions?: (suggestions: ProposedSuggestion[]) => void;
}

export interface UseGeminiVoiceResult {
  status: VoiceStatus;
  isConnected: boolean;
  conversationMode: boolean;
  toggleConversationMode: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  sendText: (text: string) => void;
  stopSpeaking: () => void;
  error: string | null;
}

const TARGET_SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

export function useGeminiVoice(options: UseGeminiVoiceOptions): UseGeminiVoiceResult {
  const { mode, patientUserId, onTranscript, onBargeIn, onProposedMemories, onProposedSuggestions } = options;

  const [conversationMode, setConversationMode] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Refs for stable access in callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const stoppedRef = useRef(false);
  const pendingTurnCompleteRef = useRef(false);

  // Stable callback refs
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onBargeInRef = useRef(onBargeIn);
  onBargeInRef.current = onBargeIn;
  const onProposedMemoriesRef = useRef(onProposedMemories);
  onProposedMemoriesRef.current = onProposedMemories;
  const onProposedSuggestionsRef = useRef(onProposedSuggestions);
  onProposedSuggestionsRef.current = onProposedSuggestions;

  const statusRef = useRef(status);
  statusRef.current = status;
  const conversationModeRef = useRef(conversationMode);
  conversationModeRef.current = conversationMode;

  // ─── Audio playback ───

  const stopCurrentAudio = useCallback(() => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch { /* already stopped */ }
      activeSourceRef.current = null;
    }
  }, []);

  const drainQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    if (statusRef.current !== "speaking") setStatus("speaking");

    if (!playbackContextRef.current) {
      try {
        playbackContextRef.current = new (
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )({ sampleRate: PLAYBACK_SAMPLE_RATE });
      } catch {
        isPlayingRef.current = false;
        return;
      }
    }
    const ctx = playbackContextRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    while (audioQueueRef.current.length > 0 && !stoppedRef.current) {
      const rawBuffer = audioQueueRef.current.shift()!;
      try {
        // Convert PCM16 Int16Array to Float32Array for AudioBuffer
        const int16 = new Int16Array(rawBuffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        const audioBuffer = ctx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
        audioBuffer.getChannelData(0).set(float32);

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
        // Skip decode errors
      }
    }

    isPlayingRef.current = false;

    // If turn is complete and queue is empty, transition state
    if (pendingTurnCompleteRef.current && audioQueueRef.current.length === 0) {
      pendingTurnCompleteRef.current = false;
      stoppedRef.current = false;
      if (conversationModeRef.current) {
        setStatus("listening");
      } else {
        setStatus("idle");
      }
    }
  }, []);

  // ─── WebSocket message handler ───

  const handleWsMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
      // Binary = PCM16 audio from Gemini at 24kHz
      const processBuffer = (buf: ArrayBuffer) => {
        if (stoppedRef.current) return;
        audioQueueRef.current.push(buf);
        void drainQueue();
      };

      if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then(processBuffer);
      } else {
        processBuffer(event.data);
      }
      return;
    }

    // JSON control messages
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string); } catch { return; }

    switch (msg.type) {
      case "ready":
        setStatus("listening");
        break;

      case "turnComplete": {
        const transcript = typeof msg.transcript === "string" ? msg.transcript : undefined;
        if (transcript) onTranscriptRef.current?.(transcript);

        // If audio is still playing, defer state transition
        if (isPlayingRef.current || audioQueueRef.current.length > 0) {
          pendingTurnCompleteRef.current = true;
        } else {
          stoppedRef.current = false;
          if (conversationModeRef.current) {
            setStatus("listening");
          } else {
            setStatus("idle");
          }
        }
        break;
      }

      case "interrupted":
        // Barge-in: stop playback immediately
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        pendingTurnCompleteRef.current = false;
        stoppedRef.current = false;
        stopCurrentAudio();
        onBargeInRef.current?.();
        if (conversationModeRef.current) {
          setStatus("listening");
        } else {
          setStatus("idle");
        }
        break;

      case "proposedMemories":
        if (Array.isArray(msg.memories)) {
          onProposedMemoriesRef.current?.(msg.memories as ProposedMemory[]);
        }
        break;

      case "proposedSuggestions":
        if (Array.isArray(msg.suggestions)) {
          onProposedSuggestionsRef.current?.(msg.suggestions as ProposedSuggestion[]);
        }
        break;

      case "error":
        setError(typeof msg.error === "string" ? msg.error : "Voice error");
        break;
    }
  }, [drainQueue, stopCurrentAudio]);

  // ─── Mic capture ───

  const startMicCapture = useCallback(async (ws: WebSocket) => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied.");
      return;
    }
    micStreamRef.current = stream;

    // AudioContext for mic capture at browser's native rate
    const micCtx = new (
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    micContextRef.current = micCtx;

    const source = micCtx.createMediaStreamSource(stream);
    const processor = micCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    micProcessorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const float32 = e.inputBuffer.getChannelData(0);

      // Resample from native rate to 16kHz
      const nativeRate = micCtx.sampleRate;
      const ratio = nativeRate / TARGET_SAMPLE_RATE;
      const newLength = Math.floor(float32.length / ratio);
      const resampled = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        resampled[i] = float32[Math.floor(i * ratio)];
      }

      // Convert Float32 to Int16
      const int16 = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      ws.send(int16.buffer);
    };

    source.connect(processor);
    processor.connect(micCtx.destination);
    setStatus("recording");
  }, []);

  const stopMicCapture = useCallback(() => {
    if (micProcessorRef.current) {
      try { micProcessorRef.current.disconnect(); } catch { /* */ }
      micProcessorRef.current = null;
    }
    if (micContextRef.current) {
      void micContextRef.current.close();
      micContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  // ─── Public methods ───

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "text", text }));
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true;
    audioQueueRef.current = [];
    pendingTurnCompleteRef.current = false;
    isPlayingRef.current = false;
    stopCurrentAudio();
    if (conversationModeRef.current) {
      setStatus("listening");
    } else {
      setStatus("idle");
    }
  }, [stopCurrentAudio]);

  const connectWebSocket = useCallback(async (mode: "patient" | "physician", patientUserId?: string, threadId?: string) => {
    setError(null);
    setStatus("connecting");

    try {
      // Get auth token from init endpoint
      const initRes = await fetch("/api/voice/live/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, patientUserId, threadId }),
      });
      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Failed to initialize voice session");
      }
      const { token } = (await initRes.json()) as { token: string };

      // Connect WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/voice/live?token=${token}`);
      wsRef.current = ws;

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        // Send initial config
        ws.send(JSON.stringify({
          type: "config",
          mode,
          patientUserId,
          threadId,
        }));
      };

      ws.onmessage = handleWsMessage;

      ws.onerror = () => {
        setError("WebSocket connection error");
        setStatus("idle");
      };

      ws.onclose = () => {
        wsRef.current = null;
        stopMicCapture();
        if (statusRef.current !== "idle") {
          setStatus("idle");
        }
      };

      // Start mic capture once connected
      await startMicCapture(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("idle");
    }
  }, [handleWsMessage, startMicCapture, stopMicCapture]);

  const disconnectWebSocket = useCallback(() => {
    stopMicCapture();
    stopSpeaking();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("idle");
  }, [stopMicCapture, stopSpeaking]);

  const toggleConversationMode = useCallback(() => {
    setConversationMode((prev) => {
      const next = !prev;
      if (next) {
        // Turning ON — connect
        void connectWebSocket(mode, patientUserId);
      } else {
        // Turning OFF — disconnect
        disconnectWebSocket();
      }
      return next;
    });
  }, [connectWebSocket, disconnectWebSocket, mode, patientUserId]);

  const startRecording = useCallback(() => {
    if (statusRef.current !== "idle") return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Already connected, just start mic if not already
      setStatus("recording");
    }
    // If not connected, the conversation mode toggle handles connection
  }, []);

  const stopRecording = useCallback(() => {
    if (statusRef.current === "recording") {
      // With Gemini Live API, VAD handles end-of-speech detection automatically.
      // We can optionally send an end-of-speech signal.
      setStatus("listening");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  return {
    status,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    conversationMode,
    toggleConversationMode,
    startRecording,
    stopRecording,
    sendText,
    stopSpeaking,
    error,
  };
}
