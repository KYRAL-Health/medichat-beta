"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DocumentInsightsDrawer } from "@/components/DocumentInsightsDrawer";
import { LoadingDots } from "@/components/LoadingDots";

type DocumentRow = {
  id: string;
  patientUserId: string;
  uploadedByUserId: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  bucket: string | null;
  objectKey: string | null;
  status: "uploaded" | "parsed" | "error";
  parsedAt: string | null;
  parseError: string | null;
  createdAt: string;
};

export function DocumentManager({ patientUserId }: { patientUserId?: string }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [insightsDocId, setInsightsDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = patientUserId
        ? `?patientUserId=${encodeURIComponent(patientUserId)}`
        : "";
      const res = await fetch(`/api/documents${qs}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        documents?: DocumentRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setDocuments(Array.isArray(body.documents) ? body.documents : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [patientUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Allow deep-linking to insights (e.g. from Health Map): ?insights=<documentId>
  useEffect(() => {
    const id = searchParams.get("insights");
    if (id && typeof id === "string") {
      setInsightsDocId(id);
    }
    // We intentionally do not clear the query param here; the drawer can be reopened via refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const upload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (patientUserId) form.set("patientUserId", patientUserId);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(body.error || `Upload failed (${res.status})`);
      setFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }, [file, load, patientUserId]);

  const parse = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/documents/${id}/parse`, {
          method: "POST",
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok)
          throw new Error(body.error || `Parse failed (${res.status})`);
        // Instant AHA: open insights as soon as parsing completes.
        setInsightsDocId(id);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Parse failed");
      } finally {
        setLoading(false);
      }
    },
    [load]
  );

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Upload a document</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            PDFs and text files are supported. After upload, click “Parse” to
            extract structured data into the patient record.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative group w-full sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,text/plain,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={[
                  "flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border transition-all duration-200 w-full sm:w-auto",
                  file
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300",
                ].join(" ")}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>{file ? "Change file" : "Choose file"}</span>
              </button>
            </div>

            {file && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 medichat-animate-in max-w-full">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-zinc-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4"
                  />
                </svg>
                <span className="text-xs font-medium truncate flex-1 min-w-0">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ml-1 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 shrink-0"
                  title="Remove file"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto self-end">
            <div className="flex-1 sm:flex-none" />
            <button
              type="button"
              onClick={() => void upload()}
              disabled={loading || !file}
              className="flex-1 sm:flex-none px-4 py-2 rounded bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50 transition-all active:scale-[0.98] text-center justify-center"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span>Working</span>
                  <LoadingDots />
                </span>
              ) : (
                "Upload"
              )}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="px-4 py-2 rounded border border-zinc-200 dark:border-zinc-800 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
        <div className="p-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Documents</h2>
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span>Loading</span>
                <LoadingDots sizeClassName="h-1 w-1" />
              </span>
            ) : (
              `${documents.length} item(s)`
            )}
          </div>
        </div>

        {documents.length ? (
          documents.map((d) => (
            <div key={d.id} className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {d.originalFileName}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                        {d.contentType} · {Math.round(d.sizeBytes / 1024)} KB ·{" "}
                        {new Date(d.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={[
                        "text-xs px-2 py-1 rounded border shrink-0",
                        d.status === "parsed"
                          ? "border-green-500/30 text-green-800 dark:text-green-200 bg-green-500/10"
                          : d.status === "error"
                          ? "border-red-500/30 text-red-700 dark:text-red-200 bg-red-500/10"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200",
                      ].join(" ")}
                    >
                      {d.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/documents/${d.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs sm:text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 whitespace-nowrap"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      onClick={() => setInsightsDocId(d.id)}
                      disabled={loading || d.status !== "parsed"}
                      className="px-3 py-1.5 text-xs sm:text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 whitespace-nowrap"
                    >
                      Insights
                    </button>
                    <button
                      type="button"
                      onClick={() => void parse(d.id)}
                      disabled={loading || d.status === "parsed"}
                      className="px-3 py-1.5 text-xs sm:text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 whitespace-nowrap"
                    >
                      Parse
                    </button>
                  </div>
                </div>
              </div>

              {d.parseError ? (
                <div className="text-xs text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                  Error: {d.parseError}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
            No documents yet.
          </div>
        )}
      </section>

      <DocumentInsightsDrawer
        documentId={insightsDocId}
        onClose={() => setInsightsDocId(null)}
      />
    </div>
  );
}


