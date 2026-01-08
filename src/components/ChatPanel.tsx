"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Textarea } from "@/components/ui/Textarea";

type Mode = "patient" | "physician";

type ProposedMemory = {
  id: string;
  memoryText: string;
  category: string | null;
};

type ProposedSuggestion = {
  id: string;
  kind: string;
  summaryText: string;
};

type ChatMessage = {
  id: string;
  senderRole: "user" | "assistant";
  content: string;
  createdAt: string | Date;
};

export function ChatPanel({
  mode,
  patientUserId,
  initialThreadId,
  initialMessages = [],
  initialProposedMemories = [],
  initialProposedSuggestions = [],
}: {
  mode: Mode;
  patientUserId?: string;
  initialThreadId?: string;
  initialMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  initialProposedMemories?: ProposedMemory[];
  initialProposedSuggestions?: ProposedSuggestion[];
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
  const [suggestions, setSuggestions] = useState<ProposedSuggestion[]>(
    initialProposedSuggestions
  );
  
  // Attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  
  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const send = useCallback(async (msgText?: string) => {
    const text = (msgText ?? input).trim();
    if ((!text && !file) || loading) return;
    
    // Optimistic UI updates
    const tempFile = file;
    setInput("");
    setFile(null);
    setError(null);
    setLoading(true);

    const userContent = [
        text,
        tempFile ? `\n\n*[Attached: ${tempFile.name}]*` : ""
    ].filter(Boolean).join("");

    setMessages((prev) => [...prev, { role: "user", content: userContent }]);

    try {
      const documentIds: string[] = [];

      // 1. Upload & Parse if file attached
      if (tempFile) {
        const form = new FormData();
        form.set("file", tempFile);
        if (patientUserId) form.set("patientUserId", patientUserId);

        const uploadRes = await fetch("/api/documents/upload", {
            method: "POST",
            body: form,
        });
        const uploadBody = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadBody.error || "Upload failed");
        
        const docId = uploadBody.document.id;
        documentIds.push(docId);

        // Auto-parse
        const parseRes = await fetch(`/api/documents/${docId}/parse`, { method: "POST" });
        if (!parseRes.ok) {
            console.error("Parse failed", await parseRes.json());
        }
      }

      // 2. Send Chat
      const payload: Record<string, unknown> = {
        mode,
        message: text || (tempFile ? "Uploaded a document." : ""),
        documentIds: documentIds.length ? documentIds : undefined,
      };
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
        proposedSuggestions?: ProposedSuggestion[];
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
      if (Array.isArray(body.proposedMemories) && body.proposedMemories.length) {
        setProposed((prev) => [...prev, ...body.proposedMemories!]);
      }
      if (Array.isArray(body.proposedSuggestions) && body.proposedSuggestions.length) {
        setSuggestions((prev) => [...prev, ...body.proposedSuggestions!]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
      router.refresh();
    }
  }, [input, loading, mode, patientUserId, router, threadId, file]);

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

  const acceptSuggestion = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${id}/accept`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(body.error || `Accept failed (${res.status})`);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      router.refresh(); // Refresh data to show updates
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    }
  }, [router]);

  const rejectSuggestion = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${id}/reject`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(body.error || `Reject failed (${res.status})`);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    }
  }, []);

  const suggestedPrompts = useMemo(() => {
    if (mode === "patient") {
        return [
            "I'm feeling some pain",
            "Check my recent labs",
            "Explain my meds",
            "I want to log a symptom",
        ];
    }
    return [
        "Summarize patient status",
        "Check for recent red flags",
        "Draft a care plan update",
    ];
  }, [mode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const handlePromptClick = (prompt: string) => {
      setInput(prompt);
      // Optional: focus the input
      textareaRef.current?.focus(); 
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-2 scroll-smooth"
      >
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
                  "max-w-[85%] rounded-2xl px-5 py-3 text-base leading-relaxed",
                  m.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black rounded-br-sm"
                    : "bg-zinc-100 dark:bg-zinc-900 rounded-bl-sm prose prose-zinc dark:prose-invert max-w-none",
                ].join(" ")}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8 opacity-60">
             <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-900">
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
             </div>
             <p className="text-zinc-500 max-w-xs">
                {mode === 'patient' 
                    ? "Start a conversation about your health. I can help track symptoms, explain labs, and more."
                    : "Start a conversation to review this patient's records and get clinical decision support."
                }
             </p>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl rounded-bl-sm px-5 py-3">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
                  style={{ animation: "medichat-bounce 1.2s infinite", animationDelay: "0ms" }}
                />
                <span
                  className="inline-block h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
                  style={{ animation: "medichat-bounce 1.2s infinite", animationDelay: "150ms" }}
                />
                <span
                  className="inline-block h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
                  style={{ animation: "medichat-bounce 1.2s infinite", animationDelay: "300ms" }}
                />
              </span>
            </div>
          </div>
        )}
        
        {error && (
            <div className="flex justify-center">
                <div className="rounded-full bg-red-100 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
                    <span>{error}</span>
                    <button onClick={() => void send()} className="font-medium hover:underline">Retry</button>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* Input Area */}
      <div className="space-y-3 shrink-0 pt-2">
        {/* Memory Proposals */}
        {proposed.length > 0 && (
            <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1">Proposed Memories</div>
                {proposed.map((m) => (
                <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-sm"
                >
                    <span className="mr-4">{m.memoryText}</span>
                    <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => void rejectMemory(m.id)}>Reject</Button>
                        <Button size="sm" onClick={() => void acceptMemory(m.id)}>Save</Button>
                    </div>
                </div>
                ))}
            </div>
        )}

        {/* Suggestions to Save */}
        {suggestions.length > 0 && (
            <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1">Suggestions to Save</div>
                {suggestions.map((s) => (
                <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 text-sm"
                >
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">{s.kind.replace('_', ' ')}</span>
                        <span>{s.summaryText}</span>
                    </div>
                    <div className="flex gap-2 shrink-0 items-center">
                        <Button size="sm" variant="ghost" onClick={() => void rejectSuggestion(s.id)}>Reject</Button>
                        <Button size="sm" onClick={() => void acceptSuggestion(s.id)}>Save</Button>
                    </div>
                </div>
                ))}
            </div>
        )}

        {/* Suggested Prompts */}
        <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
                <Chip 
                    key={prompt} 
                    onClick={() => handlePromptClick(prompt)}
                    className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-70 hover:opacity-100 transition-opacity bg-transparent border-dashed border-zinc-300 dark:border-zinc-700"
                >
                    {prompt}
                </Chip>
            ))}
        </div>

        {/* Composer */}
        <div className="relative flex flex-col gap-2 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:focus-within:ring-zinc-100/10 transition-shadow shadow-sm">
            {/* File attachment preview */}
            {file && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <button 
                        onClick={() => setFile(null)} 
                        className="ml-1 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
                    >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="flex items-end gap-2 w-full">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} 
                    accept=".pdf,.txt,application/pdf,text/plain"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 mb-0.5"
                    title="Attach document (PDF/TXT)"
                >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
                
                <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your health..."
                    className="flex-1 min-h-[44px] max-h-48 bg-transparent border-none focus-visible:ring-0 p-2 text-base resize-none"
                    rows={1}
                />
                
                <Button 
                    onClick={() => void send()}
                    disabled={loading || (!input.trim() && !file)}
                    size="icon"
                    className="mb-0.5 shrink-0 rounded-lg"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </Button>
            </div>
        </div>
        <div className="text-center">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                MediChat can make mistakes. Please verify important information.
            </span>
        </div>
      </div>
    </div>
  );
}
