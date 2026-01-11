"use client";

import Link from "next/link";
import { useMemo } from "react";

type Doc = {
  id: string;
  originalFileName: string;
  status: "uploaded" | "parsed" | "error";
  createdAt: string;
};

type Lab = {
  id: string;
  testName: string;
  flag: string | null;
  collectedAt: string;
  sourceDocumentId: string | null;
};

type Vital = {
  id: string;
  measuredAt: string;
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
  temperatureC: number | null;
  sourceDocumentId: string | null;
};

type Medication = {
  id: string;
  medicationName: string;
  active: boolean;
  notedAt: string;
  sourceDocumentId: string | null;
};

type Condition = {
  id: string;
  conditionName: string;
  status: string | null;
  notedAt: string;
  sourceDocumentId: string | null;
};

type Memory = {
  id: string;
  memoryText: string;
  category: string | null;
  acceptedAt: string | null;
};

function truncateMiddle(value: string, max: number) {
  const v = value.trim();
  if (v.length <= max) return v;
  const keep = Math.max(4, Math.floor((max - 3) / 2));
  return `${v.slice(0, keep)}…${v.slice(v.length - keep)}`;
}

export function HealthMapClient({
  mode,
  patientUserId,
  documents,
  labs,
  vitals,
  medications,
  conditions,
  memories,
}: {
  mode: "patient" | "physician";
  patientUserId: string;
  documents: Doc[];
  labs: Lab[];
  vitals: Vital[];
  medications: Medication[];
  conditions: Condition[];
  memories: Memory[];
}) {
  const model = useMemo(() => {
    const labsFlagged = labs.filter((l) => Boolean(l.flag)).length;
    const docsParsed = documents.filter((d) => d.status === "parsed").length;

    const byDoc: Record<
      string,
      { labs: number; vitals: number; medications: number; conditions: number; flaggedLabs: number }
    > = {};

    for (const l of labs) {
      if (!l.sourceDocumentId) continue;
      (byDoc[l.sourceDocumentId] ??= {
        labs: 0,
        vitals: 0,
        medications: 0,
        conditions: 0,
        flaggedLabs: 0,
      }).labs++;
      if (l.flag) byDoc[l.sourceDocumentId]!.flaggedLabs++;
    }
    for (const v of vitals) {
      if (!v.sourceDocumentId) continue;
      (byDoc[v.sourceDocumentId] ??= {
        labs: 0,
        vitals: 0,
        medications: 0,
        conditions: 0,
        flaggedLabs: 0,
      }).vitals++;
    }
    for (const m of medications) {
      if (!m.sourceDocumentId) continue;
      (byDoc[m.sourceDocumentId] ??= {
        labs: 0,
        vitals: 0,
        medications: 0,
        conditions: 0,
        flaggedLabs: 0,
      }).medications++;
    }
    for (const c of conditions) {
      if (!c.sourceDocumentId) continue;
      (byDoc[c.sourceDocumentId] ??= {
        labs: 0,
        vitals: 0,
        medications: 0,
        conditions: 0,
        flaggedLabs: 0,
      }).conditions++;
    }

    const topDocs = documents.slice(0, 4).map((d) => ({
      ...d,
      counts: byDoc[d.id] ?? {
        labs: 0,
        vitals: 0,
        medications: 0,
        conditions: 0,
        flaggedLabs: 0,
        
      },
    }));

    const topMemories = memories.slice(0, 4).map((m) => ({
      ...m,
      short: truncateMiddle(m.memoryText, 46),
    }));

    const insightsHrefForDoc = (docId: string) =>
      mode === "physician"
        ? `/physician/patients/${encodeURIComponent(patientUserId)}?insights=${encodeURIComponent(
            docId
          )}`
        : `/patient/documents?insights=${encodeURIComponent(docId)}`;

    return {
      docsParsed,
      labsFlagged,
      topDocs,
      topMemories,
      insightsHrefForDoc,
    };
  }, [conditions, documents, labs, medications, mode, memories, patientUserId, vitals]);

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Health Map</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            A provenance-first view of how documents and data connect.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={mode === "physician" ? `/physician/patients/${patientUserId}` : "/patient/dashboard"}
            className="px-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Back
          </Link>
          <Link
            href={mode === "physician" ? `/physician/patients/${patientUserId}` : "/patient/documents"}
            className="px-3 py-2 text-sm rounded bg-zinc-900 text-white dark:bg-white dark:text-black"
          >
            Documents
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black p-3">
        <svg viewBox="0 0 900 520" className="w-full h-auto">
          {/* Edges */}
          {(() => {
            const lines: Array<React.ReactElement> = [];

            // Patient -> categories
            const patientCx = 450;
            const patientBottom = 80;
            const catLeft = 320;
            const catYs = [150, 230, 310, 390];
            for (const y of catYs) {
              lines.push(
                <line
                  key={`p-cat-${y}`}
                  x1={patientCx}
                  y1={patientBottom}
                  x2={catLeft}
                  y2={y}
                  className="stroke-zinc-300 dark:stroke-zinc-700"
                  strokeWidth={2}
                />
              );
            }

            // Docs -> categories (only if doc contributed)
            const docRight = 280;
            const docYs = [150, 230, 310, 390];
            model.topDocs.forEach((d, idx) => {
              const y = docYs[idx] ?? 150;
              const { labs, vitals, medications, conditions } = d.counts;
              const to: Array<[number, boolean]> = [
                [150, labs > 0],
                [230, vitals > 0],
                [310, medications > 0],
                [390, conditions > 0],
              ];
              for (const [cy, on] of to) {
                if (!on) continue;
                lines.push(
                  <line
                    key={`d-${d.id}-${cy}`}
                    x1={docRight}
                    y1={y}
                    x2={catLeft}
                    y2={cy}
                    className="stroke-zinc-400/80 dark:stroke-zinc-600/80"
                    strokeWidth={2}
                  />
                );
              }
            });

            // Patient -> memories
            const memLeft = 620;
            const memYs = [150, 230, 310, 390];
            model.topMemories.forEach((m, idx) => {
              const y = memYs[idx] ?? 150;
              lines.push(
                <line
                  key={`p-m-${m.id}`}
                  x1={patientCx}
                  y1={patientBottom}
                  x2={memLeft}
                  y2={y}
                  className="stroke-zinc-300 dark:stroke-zinc-700"
                  strokeWidth={2}
                />
              );
            });

            return lines;
          })()}

          {/* Patient node */}
          <g>
            <rect
              x={360}
              y={20}
              width={180}
              height={60}
              rx={16}
              className="fill-white dark:fill-zinc-950 stroke-zinc-200 dark:stroke-zinc-800"
              strokeWidth={2}
            />
            <text
              x={450}
              y={45}
              textAnchor="middle"
              className="fill-zinc-900 dark:fill-zinc-50"
              fontSize={14}
              fontWeight={700}
            >
              Patient
            </text>
            <text
              x={450}
              y={65}
              textAnchor="middle"
              className="fill-zinc-600 dark:fill-zinc-400"
              fontSize={11}
            >
              {mode === "patient" ? "You" : "Shared record"}
            </text>
          </g>

          {/* Documents column */}
          <text x={20} y={110} className="fill-zinc-600 dark:fill-zinc-400" fontSize={12} fontWeight={600}>
            Documents
          </text>
          {model.topDocs.map((d, idx) => {
            const y = 120 + idx * 80;
            const title = truncateMiddle(d.originalFileName, 28);
            const sub = [
              d.counts.labs ? `Labs +${d.counts.labs}` : null,
              d.counts.vitals ? `Vitals +${d.counts.vitals}` : null,
              d.counts.medications ? `Meds +${d.counts.medications}` : null,
              d.counts.conditions ? `Cond +${d.counts.conditions}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            const statusColor =
              d.status === "parsed"
                ? "fill-green-700 dark:fill-green-200"
                : d.status === "error"
                ? "fill-red-700 dark:fill-red-200"
                : "fill-zinc-600 dark:fill-zinc-400";

            return (
              <g key={d.id}>
                <rect
                  x={20}
                  y={y}
                  width={260}
                  height={60}
                  rx={14}
                  className="fill-white dark:fill-zinc-950 stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth={2}
                />
                <text x={34} y={y + 24} className="fill-zinc-900 dark:fill-zinc-50" fontSize={12} fontWeight={700}>
                  {title}
                </text>
                <text x={34} y={y + 43} className={statusColor} fontSize={11} fontWeight={600}>
                  {d.status}
                </text>
                <text x={100} y={y + 43} className="fill-zinc-600 dark:fill-zinc-400" fontSize={10}>
                  {sub || "No extracted items linked"}
                </text>
                {/* Click target */}
                <a href={model.insightsHrefForDoc(d.id)}>
                  <rect x={20} y={y} width={260} height={60} rx={14} fill="transparent" />
                </a>
              </g>
            );
          })}

          {documents.length > model.topDocs.length ? (
            <text x={20} y={470} className="fill-zinc-500 dark:fill-zinc-500" fontSize={11}>
              +{documents.length - model.topDocs.length} more
            </text>
          ) : null}

          {/* Categories */}
          <text x={320} y={110} className="fill-zinc-600 dark:fill-zinc-400" fontSize={12} fontWeight={600}>
            Patient record
          </text>

          {(() => {
            const cats: Array<{
              key: string;
              y: number;
              title: string;
              value: string;
              sub?: string;
              subTone?: "muted" | "danger";
            }> = [
              {
                key: "labs",
                y: 120,
                title: "Labs",
                value: `${labs.length}`,
                sub: model.labsFlagged ? `${model.labsFlagged} flagged` : "No flags",
                subTone: model.labsFlagged ? "danger" : "muted",
              },
              {
                key: "vitals",
                y: 200,
                title: "Vitals",
                value: `${vitals.length}`,
                sub: vitals.length ? `Latest: ${new Date(vitals[0]!.measuredAt).toLocaleDateString()}` : "—",
                subTone: "muted",
              },
              {
                key: "meds",
                y: 280,
                title: "Medications",
                value: `${medications.length}`,
                sub: medications.filter((m) => m.active).length
                  ? `${medications.filter((m) => m.active).length} active`
                  : "—",
                subTone: "muted",
              },
              {
                key: "cond",
                y: 360,
                title: "Conditions",
                value: `${conditions.length}`,
                sub: conditions.length ? truncateMiddle(conditions[0]!.conditionName, 24) : "—",
                subTone: "muted",
              },
            ];

            return cats.map((c) => (
              <g key={c.key}>
                <rect
                  x={320}
                  y={c.y}
                  width={260}
                  height={60}
                  rx={14}
                  className="fill-white dark:fill-zinc-950 stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth={2}
                />
                <text x={334} y={c.y + 24} className="fill-zinc-900 dark:fill-zinc-50" fontSize={12} fontWeight={700}>
                  {c.title}
                </text>
                <text x={560} y={c.y + 24} textAnchor="end" className="fill-zinc-900 dark:fill-zinc-50" fontSize={18} fontWeight={800}>
                  {c.value}
                </text>
                <text
                  x={334}
                  y={c.y + 43}
                  className={
                    c.subTone === "danger"
                      ? "fill-red-700 dark:fill-red-200"
                      : "fill-zinc-600 dark:fill-zinc-400"
                  }
                  fontSize={11}
                  fontWeight={600}
                >
                  {c.sub ?? ""}
                </text>
              </g>
            ));
          })()}

          {/* Memories */}
          <text x={620} y={110} className="fill-zinc-600 dark:fill-zinc-400" fontSize={12} fontWeight={600}>
            AI memories (accepted)
          </text>
          {model.topMemories.map((m, idx) => {
            const y = 120 + idx * 80;
            return (
              <g key={m.id}>
                <rect
                  x={620}
                  y={y}
                  width={260}
                  height={60}
                  rx={14}
                  className="fill-white dark:fill-zinc-950 stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth={2}
                />
                <text x={634} y={y + 24} className="fill-zinc-900 dark:fill-zinc-50" fontSize={12} fontWeight={700}>
                  {m.short}
                </text>
                <text x={634} y={y + 43} className="fill-zinc-600 dark:fill-zinc-400" fontSize={10}>
                  {m.category ? `Category: ${m.category}` : "Category: —"}
                </text>
              </g>
            );
          })}

          {!memories.length ? (
            <text x={620} y={170} className="fill-zinc-500 dark:fill-zinc-500" fontSize={11}>
              No accepted memories yet.
            </text>
          ) : null}
        </svg>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-500">
        Tip: click a document node to jump to its insights.
        {" · "}
        Parsed docs: {model.docsParsed}/{documents.length}
      </div>
    </section>
  );
}


