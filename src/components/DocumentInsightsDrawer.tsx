"use client";

import { useEffect, useMemo, useState } from "react";

type InsightsResponse = {
  ok: boolean;
  error?: string;
  document?: {
    id: string;
    patientUserId: string;
    uploadedByUserId: string;
    originalFileName: string;
    contentType: string;
    sizeBytes: number;
    status: "uploaded" | "parsed" | "error";
    parsedAt: string | null;
    parseError: string | null;
    createdAt: string;
    urls: { open: string; download: string };
  };
  extraction?: {
    id: string;
    documentId: string;
    model: string;
    extractedJson: any;
    createdAt: string;
  } | null;
  created?: {
    vitals: Array<{
      id: string;
      measuredAt: string;
      systolic: number | null;
      diastolic: number | null;
      heartRate: number | null;
      temperatureC: number | null;
    }>;
    labs: Array<{
      id: string;
      collectedAt: string;
      testName: string;
      valueText: string;
      unit: string | null;
      referenceRange: string | null;
      flag: string | null;
    }>;
    medications: Array<{
      id: string;
      medicationName: string;
      dose: string | null;
      frequency: string | null;
      active: boolean;
      notedAt: string;
    }>;
    conditions: Array<{
      id: string;
      conditionName: string;
      status: string | null;
      notedAt: string;
    }>;
  };
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = i === 0 ? `${Math.round(v)}` : `${v.toFixed(1)}`;
  return `${rounded} ${units[i]}`;
}

export function DocumentInsightsDrawer({
  documentId,
  onClose,
}: {
  documentId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InsightsResponse | null>(null);

  useEffect(() => {
    if (!documentId) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/insights`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const body = (await res.json().catch(() => ({}))) as InsightsResponse;
        if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
        setData(body);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load insights");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [documentId]);

  const doc = data?.document;
  const created = data?.created;
  const extracted = data?.extraction?.extractedJson as any;

  const counts = useMemo(() => {
    const labs = created?.labs?.length ?? 0;
    const vitals = created?.vitals?.length ?? 0;
    const meds = created?.medications?.length ?? 0;
    const conditions = created?.conditions?.length ?? 0;
    const flagged = (created?.labs ?? []).filter((l) => l.flag).length;
    return { labs, vitals, meds, conditions, flagged };
  }, [created]);

  if (!documentId) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              Document insights
            </div>
            <div className="text-sm font-semibold truncate">
              {doc?.originalFileName ?? "Loading…"}
            </div>
            {doc ? (
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                {doc.contentType} · {formatBytes(doc.sizeBytes)} ·{" "}
                {new Date(doc.createdAt).toLocaleString()}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="p-4 overflow-auto space-y-4">
          {error ? (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Building your timeline…
            </div>
          ) : null}

          {doc ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                className="px-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                href={doc.urls.open}
                target="_blank"
                rel="noreferrer"
              >
                Open document
              </a>
              <a
                className="px-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                href={doc.urls.download}
              >
                Download
              </a>
              {data?.extraction?.model ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  Extract model: {data.extraction.model}
                </span>
              ) : null}
            </div>
          ) : null}

          {created ? (
            <section className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  Labs
                </div>
                <div className="text-lg font-semibold">{counts.labs}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  Vitals
                </div>
                <div className="text-lg font-semibold">{counts.vitals}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  Meds
                </div>
                <div className="text-lg font-semibold">{counts.meds}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  Conditions
                </div>
                <div className="text-lg font-semibold">{counts.conditions}</div>
              </div>
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="text-xs text-red-700 dark:text-red-200">
                  Flagged labs
                </div>
                <div className="text-lg font-semibold text-red-700 dark:text-red-200">
                  {counts.flagged}
                </div>
              </div>
            </section>
          ) : null}

          {extracted?.hpi?.historyOfPresentIllness ? (
            <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2">
              <div className="text-sm font-semibold">From the document</div>
              <div className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                {extracted.hpi.historyOfPresentIllness}
              </div>
            </section>
          ) : null}

          {created?.labs?.length ? (
            <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2">
              <div className="text-sm font-semibold">Labs extracted</div>
              <ul className="space-y-2 text-sm">
                {created.labs.slice(0, 50).map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{l.testName}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-500">
                        {new Date(l.collectedAt).toLocaleDateString()}
                        {l.referenceRange ? ` · ref ${l.referenceRange}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div>
                        {l.valueText}
                        {l.unit ? ` ${l.unit}` : ""}
                      </div>
                      {l.flag ? (
                        <div className="text-xs text-red-700 dark:text-red-200">
                          {l.flag}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {created.labs.length > 50 ? (
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  Showing 50 of {created.labs.length}.
                </div>
              ) : null}
            </section>
          ) : null}

          {created?.vitals?.length ? (
            <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2">
              <div className="text-sm font-semibold">Vitals extracted</div>
              <ul className="space-y-2 text-sm">
                {created.vitals.slice(0, 50).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="text-xs text-zinc-500 dark:text-zinc-500">
                      {new Date(v.measuredAt).toLocaleString()}
                    </div>
                    <div className="text-right text-zinc-700 dark:text-zinc-200">
                      {v.systolic && v.diastolic
                        ? `BP ${v.systolic}/${v.diastolic}`
                        : "BP —"}
                      {" · "}
                      {v.heartRate ? `HR ${v.heartRate}` : "HR —"}
                      {" · "}
                      {v.temperatureC ? `Temp ${v.temperatureC}°C` : "Temp —"}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {created?.medications?.length ? (
            <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2">
              <div className="text-sm font-semibold">Medications extracted</div>
              <ul className="space-y-2 text-sm">
                {created.medications.slice(0, 50).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="font-medium">{m.medicationName}</div>
                    <div className="text-right text-zinc-700 dark:text-zinc-200">
                      {m.dose ?? "—"}
                      {m.frequency ? ` · ${m.frequency}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {created?.conditions?.length ? (
            <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2">
              <div className="text-sm font-semibold">Conditions extracted</div>
              <ul className="space-y-2 text-sm">
                {created.conditions.slice(0, 50).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="font-medium">{c.conditionName}</div>
                    <div className="text-right text-zinc-700 dark:text-zinc-200">
                      {c.status ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data?.extraction?.extractedJson ? (
            <details className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
              <summary className="text-sm font-semibold cursor-pointer">
                Raw extraction JSON
              </summary>
              <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                {JSON.stringify(data.extraction.extractedJson, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}


