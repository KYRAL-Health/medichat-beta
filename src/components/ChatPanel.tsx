"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "patient" | "physician";

type ProposedMemory = {
  id: string;
  memoryText: string;
  category: string | null;
};

type ChatMessage = {
  id: string;
  senderRole: "user" | "assistant";
  content: string;
  createdAt: string | Date;
};

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatPanel({
  mode,
  patientUserId,
  initialThreadId,
  initialMessages = [],
  initialProposedMemories = [],
}: {
  mode: Mode;
  patientUserId?: string;
  initialThreadId?: string;
  initialMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  initialProposedMemories?: ProposedMemory[];
}) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(
    initialThreadId ?? null
  );
  const [messages, setMessages] =
    useState<Array<{ role: "user" | "assistant"; content: string }>>(
      initialMessages
    );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<ProposedMemory[]>(
    initialProposedMemories
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const payload: Record<string, unknown> = {
        mode,
        message: text,
      };
      // Important: do not send nulls; Zod treats `threadId: null` as invalid.
      if (patientUserId) payload.patientUserId = patientUserId;
      if (threadId) payload.threadId = threadId;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        threadId?: string;
        message?: ChatMessage;
        proposedMemories?: ProposedMemory[];
      };

      if (!res.ok) {
        throw new Error(body.error || `Chat failed (${res.status})`);
      }

      if (body.threadId) setThreadId(body.threadId);
      if (body.message?.content) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: body.message!.content },
        ]);
      }
      if (
        Array.isArray(body.proposedMemories) &&
        body.proposedMemories.length
      ) {
        setProposed((prev) => [...prev, ...body.proposedMemories!]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
      // Remove the optimistic message if failed, or just keep it?
      // Keeping it allows retry.
    } finally {
      setLoading(false);
      router.refresh();
    }
  }, [input, loading, mode, patientUserId, router, threadId]);

  const acceptMemory = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/memories/${id}/accept`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(body.error || `Accept failed (${res.status})`);
      setProposed((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    }
  }, []);

  const rejectMemory = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/memories/${id}/reject`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(body.error || `Reject failed (${res.status})`);
      setProposed((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    }
  }, []);

  const header = useMemo(() => {
    if (mode === "patient")
      return "Ask about your symptoms, labs, meds, or next steps.";
    return "Ask about this patient’s status, risks, and what to check next.";
  }, [mode]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{header}</p>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void send()}
            className="shrink-0 px-3 py-1.5 text-xs rounded bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 font-medium"
          >
            Retry
          </button>
        </div>
      ) : null}

      {proposed.length ? (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
          <div className="text-sm font-semibold">Memory proposals</div>
          <div className="space-y-2">
            {proposed.map((m) => (
              <div
                key={m.id}
                className="rounded border border-zinc-200 dark:border-zinc-800 p-3 space-y-2"
              >
                <div className="text-sm">{m.memoryText}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded bg-zinc-900 text-white dark:bg-white dark:text-black disabled:opacity-50"
                    onClick={() => void acceptMemory(m.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
                    onClick={() => void rejectMemory(m.id)}
                  >
                    Don’t save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
        <div className="space-y-2">
          {messages.length ? (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={[
                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                    m.role === "user"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-black rounded-br-sm"
                      : "bg-zinc-100 dark:bg-zinc-900 rounded-bl-sm prose prose-sm dark:prose-invert max-w-none",
                  ].join(" ")}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              No messages yet.
            </div>
          )}

          {loading ? (
            <div className="flex justify-start">
              <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl rounded-bl-sm px-4 py-2 text-sm">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
                    style={{
                      animation: "medichat-bounce 1.2s infinite",
                      animationDelay: "0ms",
                    }}
                  />
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
                    style={{
                      animation: "medichat-bounce 1.2s infinite",
                      animationDelay: "150ms",
                    }}
                  />
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
                    style={{
                      animation: "medichat-bounce 1.2s infinite",
                      animationDelay: "300ms",
                    }}
                  />
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send"}
          </button>
        </div>
      </section>
    </div>
  );
}
