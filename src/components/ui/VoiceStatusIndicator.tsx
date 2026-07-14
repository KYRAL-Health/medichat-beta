"use client";

import type { VoiceStatus } from "@/hooks/useGeminiVoice";

interface VoiceStatusIndicatorProps {
  status: VoiceStatus;
}

const bars = [0, 1, 2, 3, 4] as const;

export function VoiceStatusIndicator({ status }: VoiceStatusIndicatorProps) {
  if (status === "idle") return null;

  return (
    <div className="flex justify-start">
      <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-3">
        {status === "connecting" && <ConnectingState />}
        {status === "listening" && <ListeningState />}
        {status === "recording" && <RecordingState />}
        {status === "transcribing" && <TranscribingState />}
        {status === "speaking" && <SpeakingState />}
      </div>
    </div>
  );
}

function ConnectingState() {
  return (
    <span className="inline-flex items-center gap-1.5">
      {bars.map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
          style={{
            animation: "medichat-bounce 1.2s infinite",
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </span>
  );
}

function ListeningState() {
  return (
    <span className="inline-flex items-center gap-2 text-green-600 dark:text-green-400">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 animate-[medichat-pulse_2s_ease-in-out_infinite]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
      <span className="text-sm">Listening&hellip;</span>
    </span>
  );
}

function RecordingState() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-end gap-0.5 h-5">
        {bars.map((i) => (
          <span
            key={i}
            className="w-1 bg-green-500 dark:bg-green-400 rounded-full"
            style={{
              animation: "medichat-wave 1.2s ease-in-out infinite",
              animationDelay: `${i * 100}ms`,
              height: "100%",
            }}
          />
        ))}
      </span>
      <span className="text-sm text-green-600 dark:text-green-400">
        Recording&hellip;
      </span>
    </span>
  );
}

function TranscribingState() {
  return (
    <span className="inline-flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 animate-spin"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="text-sm">Transcribing&hellip;</span>
    </span>
  );
}

function SpeakingState() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-end gap-0.5 h-5">
        {bars.map((i) => (
          <span
            key={i}
            className="w-1 bg-blue-500 dark:bg-blue-400 rounded-full"
            style={{
              animation: "medichat-wave 1.2s ease-in-out infinite",
              animationDelay: `${i * 100}ms`,
              height: "100%",
            }}
          />
        ))}
      </span>
      <span className="text-sm text-blue-600 dark:text-blue-400">
        Speaking&hellip;
      </span>
    </span>
  );
}
