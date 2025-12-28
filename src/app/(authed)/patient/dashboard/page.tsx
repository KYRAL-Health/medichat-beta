import Link from "next/link";
import { and, desc, eq, gte, isNull } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  documents,
  patientConditions,
  patientLabResults,
  patientMedications,
  patientDailyDashboards,
  patientProfiles,
  patientVitals,
  userMemories,
} from "@/server/db/schema";
import { DailyDashboardCard } from "@/components/DailyDashboardCard";

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-right">{value}</div>
    </div>
  );
}

function sparklinePath(values: number[], width: number, height: number, padding = 2) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = innerW / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = padding + i * step;
    const t = (v - min) / span;
    const y = padding + (1 - t) * innerH;
    return { x, y };
  });
  return `M ${pts[0]!.x} ${pts[0]!.y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

function Sparkline({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  const w = 140;
  const h = 34;
  const d = sparklinePath(values, w, h, 2);
  return (
    <div className="space-y-1">
      <div className="text-xs text-zinc-500 dark:text-zinc-500">{label}</div>
      {d ? (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[34px]">
          <path
            d={d}
            fill="none"
            className="stroke-zinc-900 dark:stroke-zinc-50"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <div className="h-[34px] rounded bg-zinc-100 dark:bg-zinc-900 flex items-center px-2 text-xs text-zinc-500 dark:text-zinc-500">
          Not enough data
        </div>
      )}
    </div>
  );
}

export default async function PatientDashboardPage() {
  let userId: string;
  try {
    const user = await requireAuthenticatedUser();
    userId = user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Patient dashboard</h1>
        <p className="text-sm text-red-700 dark:text-red-200">
          Unable to load dashboard: {msg}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Make sure your database is configured and reachable.
        </p>
      </div>
    );
  }

  const profile = await db.query.patientProfiles.findFirst({
    where: eq(patientProfiles.patientUserId, userId),
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const latestVitals = await db.query.patientVitals.findFirst({
    where: eq(patientVitals.patientUserId, userId),
    orderBy: [desc(patientVitals.measuredAt)],
  });

  const vitalsTrend = await db.query.patientVitals.findMany({
    where: eq(patientVitals.patientUserId, userId),
    orderBy: [desc(patientVitals.measuredAt)],
    limit: 14,
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysDashboard = await db.query.patientDailyDashboards.findFirst({
    where: and(eq(patientDailyDashboards.patientUserId, userId), eq(patientDailyDashboards.date, today)),
  });

  const docsParsedToday = await db.query.documents.findMany({
    where: and(
      eq(documents.patientUserId, userId),
      eq(documents.status, "parsed"),
      gte(documents.parsedAt, startOfToday)
    ),
    limit: 1000,
  });

  const newLabsToday = await db.query.patientLabResults.findMany({
    where: and(eq(patientLabResults.patientUserId, userId), gte(patientLabResults.createdAt, startOfToday)),
    limit: 2000,
  });

  const newVitalsToday = await db.query.patientVitals.findMany({
    where: and(eq(patientVitals.patientUserId, userId), gte(patientVitals.createdAt, startOfToday)),
    limit: 2000,
  });

  const newMedsToday = await db.query.patientMedications.findMany({
    where: and(eq(patientMedications.patientUserId, userId), gte(patientMedications.createdAt, startOfToday)),
    limit: 2000,
  });

  const newConditionsToday = await db.query.patientConditions.findMany({
    where: and(eq(patientConditions.patientUserId, userId), gte(patientConditions.createdAt, startOfToday)),
    limit: 2000,
  });

  const pendingMemories = await db.query.userMemories.findMany({
    where: and(
      eq(userMemories.ownerUserId, userId),
      eq(userMemories.status, "proposed"),
      eq(userMemories.contextMode, "patient"),
      isNull(userMemories.subjectPatientUserId)
    ),
    orderBy: [desc(userMemories.createdAt)],
    limit: 1000,
  });

  const recentLabs = await db.query.patientLabResults.findMany({
    where: eq(patientLabResults.patientUserId, userId),
    orderBy: [desc(patientLabResults.collectedAt)],
    limit: 5,
  });

  const recentDocs = await db.query.documents.findMany({
    where: eq(documents.patientUserId, userId),
    orderBy: [desc(documents.createdAt)],
    limit: 5,
  });

  const recentVitalsActivity = await db.query.patientVitals.findMany({
    where: eq(patientVitals.patientUserId, userId),
    orderBy: [desc(patientVitals.createdAt)],
    limit: 5,
  });

  const recentLabsActivity = await db.query.patientLabResults.findMany({
    where: eq(patientLabResults.patientUserId, userId),
    orderBy: [desc(patientLabResults.createdAt)],
    limit: 5,
  });

  const meds = await db.query.patientMedications.findMany({
    where: eq(patientMedications.patientUserId, userId),
    orderBy: [desc(patientMedications.notedAt)],
    limit: 5,
  });

  const conditions = await db.query.patientConditions.findMany({
    where: eq(patientConditions.patientUserId, userId),
    orderBy: [desc(patientConditions.notedAt)],
    limit: 5,
  });

  const hrSeries = vitalsTrend
    .slice()
    .reverse()
    .map((v) => v.heartRate)
    .filter((n): n is number => typeof n === "number");

  const sysSeries = vitalsTrend
    .slice()
    .reverse()
    .map((v) => v.systolic)
    .filter((n): n is number => typeof n === "number");

  const events = [
    ...recentDocs.map((d) => ({
      ts: d.parsedAt ?? d.createdAt,
      kind: "Document" as const,
      title: `${d.status === "parsed" ? "Parsed" : d.status === "error" ? "Error" : "Uploaded"}: ${d.originalFileName}`,
      href:
        d.status === "parsed"
          ? `/patient/documents?insights=${encodeURIComponent(d.id)}`
          : "/patient/documents",
      tone: d.status === "error" ? ("danger" as const) : ("muted" as const),
    })),
    ...recentVitalsActivity.map((v) => ({
      ts: v.createdAt,
      kind: "Vital" as const,
      title: `Vital added${v.systolic && v.diastolic ? `: BP ${v.systolic}/${v.diastolic}` : ""}${
        v.heartRate ? ` · HR ${v.heartRate}` : ""
      }`,
      href: v.sourceDocumentId
        ? `/patient/documents?insights=${encodeURIComponent(v.sourceDocumentId)}`
        : "/patient/data",
      tone: "muted" as const,
    })),
    ...recentLabsActivity.map((l) => ({
      ts: l.createdAt,
      kind: "Lab" as const,
      title: `Lab added: ${l.testName} ${l.valueText}${l.unit ? ` ${l.unit}` : ""}`,
      href: l.sourceDocumentId
        ? `/patient/documents?insights=${encodeURIComponent(l.sourceDocumentId)}`
        : "/patient/data",
      tone: l.flag ? ("danger" as const) : ("muted" as const),
      flag: l.flag,
    })),
    ...pendingMemories.slice(0, 3).map((m) => ({
      ts: m.createdAt,
      kind: "Memory" as const,
      title: `Memory proposed: ${m.memoryText}`,
      href: "/patient/chat",
      tone: "muted" as const,
    })),
  ]
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Patient dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Add your data, upload documents, and chat with an AI assistant grounded in your history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/patient/map"
            className="px-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Health Map
          </Link>
          <Link
            href="/patient/data"
            className="px-3 py-2 text-sm rounded bg-zinc-900 text-white dark:bg-white dark:text-black"
          >
            Update my data
          </Link>
          <Link
            href="/patient/chat"
            className="px-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Chat
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Link
          href="/patient/documents"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Docs parsed today
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {docsParsedToday.length}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Tap to view document insights.
          </div>
        </Link>

        <Link
          href="/patient/map"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Records added today
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {newLabsToday.length + newVitalsToday.length + newMedsToday.length + newConditionsToday.length}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Labs {newLabsToday.length} · Vitals {newVitalsToday.length} · Meds {newMedsToday.length} · Cond {newConditionsToday.length}
          </div>
        </Link>

        <Link
          href="/patient/chat"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Pending memories
          </div>
          <div className="mt-1 text-2xl font-semibold">{pendingMemories.length}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Review and confirm in chat.
          </div>
        </Link>

        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-xs font-semibold text-red-700 dark:text-red-200">
            Flagged labs (recent)
          </div>
          <div className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-200">
            {recentLabsActivity.filter((l) => Boolean(l.flag)).length}
          </div>
          <div className="mt-1 text-xs text-red-700/80 dark:text-red-200/80">
            Based on recently added lab entries.
          </div>
        </div>
      </section>

      <DailyDashboardCard
        initial={
          todaysDashboard
            ? {
                ...todaysDashboard,
                createdAt: todaysDashboard.createdAt.toISOString(),
              }
            : null
        }
      />

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Basics</h2>
          <Link
            href="/patient/data"
            className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            Edit
          </Link>
        </div>
        <div className="space-y-2">
          <Field label="Age" value={profile?.ageYears ? `${profile.ageYears}` : "—"} />
          <Field label="Gender" value={profile?.gender ?? "—"} />
          <Field
            label="Smoking"
            value={profile?.smokingStatus ?? "—"}
          />
          <Field
            label="Alcohol"
            value={profile?.alcoholConsumption ?? "—"}
          />
          <Field
            label="Activity"
            value={profile?.physicalActivityLevel ?? "—"}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Latest vitals</h2>
          {latestVitals ? (
            <div className="space-y-2 text-sm">
              <Field
                label="Blood pressure"
                value={
                  latestVitals.systolic && latestVitals.diastolic
                    ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                    : "—"
                }
              />
              <Field
                label="Heart rate"
                value={latestVitals.heartRate ? `${latestVitals.heartRate} bpm` : "—"}
              />
              <Field
                label="Temperature"
                value={latestVitals.temperatureC ? `${latestVitals.temperatureC}°C` : "—"}
              />
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                Measured: {new Date(latestVitals.measuredAt).toLocaleString()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Sparkline values={hrSeries} label="Heart rate trend" />
                <Sparkline values={sysSeries} label="Systolic trend" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No vitals yet. Add some in <Link className="underline" href="/patient/data">My Data</Link>.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Recent labs</h2>
          {recentLabs.length ? (
            <ul className="space-y-2 text-sm">
              {recentLabs.map((lab) => (
                <li key={lab.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{lab.testName}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-500">
                      Collected: {new Date(lab.collectedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>
                      {lab.valueText}
                      {lab.unit ? ` ${lab.unit}` : ""}
                    </div>
                    {lab.flag ? (
                      <div className="text-xs text-red-700 dark:text-red-200">
                        {lab.flag}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No labs yet. Upload a lab PDF in{" "}
              <Link className="underline" href="/patient/documents">
                Documents
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            {events.length} event(s)
          </div>
        </div>
        {events.length ? (
          <ul className="space-y-2">
            {events.map((e, idx) => {
              const badge =
                e.kind === "Document"
                  ? "bg-blue-500/10 text-blue-800 dark:text-blue-200 border-blue-500/20"
                  : e.kind === "Lab"
                  ? "bg-purple-500/10 text-purple-800 dark:text-purple-200 border-purple-500/20"
                  : e.kind === "Vital"
                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/20"
                  : "bg-zinc-900/5 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800";

              const titleEl = e.href ? (
                <Link className="hover:underline" href={e.href}>
                  {e.title}
                </Link>
              ) : (
                e.title
              );

              return (
                <li
                  key={`${e.kind}-${idx}-${e.ts.toISOString()}`}
                  className="flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "text-[11px] px-2 py-0.5 rounded border",
                          badge,
                        ].join(" ")}
                      >
                        {e.kind}
                      </span>
                      {e.kind === "Lab" && (e as any).flag ? (
                        <span className="text-[11px] px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200">
                          {(e as any).flag}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={[
                        "mt-1 text-sm truncate",
                        e.tone === "danger"
                          ? "text-red-700 dark:text-red-200"
                          : "text-zinc-800 dark:text-zinc-200",
                      ].join(" ")}
                      title={e.title}
                    >
                      {titleEl}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-zinc-500 dark:text-zinc-500">
                    {e.ts.toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            No recent activity yet.
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Medications</h2>
          {meds.length ? (
            <ul className="space-y-2 text-sm">
              {meds.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3">
                  <div className="font-medium">{m.medicationName}</div>
                  <div className="text-right text-zinc-600 dark:text-zinc-400">
                    {m.dose ?? "—"} {m.frequency ? `· ${m.frequency}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No medications yet.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <h2 className="text-sm font-semibold">Conditions</h2>
          {conditions.length ? (
            <ul className="space-y-2 text-sm">
              {conditions.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3">
                  <div className="font-medium">{c.conditionName}</div>
                  <div className="text-right text-zinc-600 dark:text-zinc-400">
                    {c.status ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No conditions yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}


