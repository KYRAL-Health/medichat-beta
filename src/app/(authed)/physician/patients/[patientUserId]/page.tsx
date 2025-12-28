import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import {
  patientConditions,
  patientLabResults,
  patientMedications,
  patientDailyDashboards,
  patientProfiles,
  patientVitals,
} from "@/server/db/schema";
import { PhysicianPatientDataEntry } from "@/components/PhysicianPatientDataEntry";
import { DocumentManager } from "@/components/DocumentManager";
import { DailyDashboardCard } from "@/components/DailyDashboardCard";

export default async function PhysicianPatientDetailPage({
  params,
}: {
  params: { patientUserId: string } | Promise<{ patientUserId: string }>;
}) {
  const { patientUserId } = await params;

  // Auth + access enforcement.
  let physicianUserId: string;
  try {
    const physician = await requireAuthenticatedUser();
    physicianUserId = physician.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Patient</h1>
        <p className="text-sm text-red-700 dark:text-red-200">Unable to load: {msg}</p>
      </div>
    );
  }

  try {
    await assertPatientAccess({ viewerUserId: physicianUserId, patientUserId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Patient</h1>
        <p className="text-sm text-red-700 dark:text-red-200">
          Access denied: {msg}
        </p>
      </div>
    );
  }

  const profile = await db.query.patientProfiles.findFirst({
    where: eq(patientProfiles.patientUserId, patientUserId),
  });

  const latestVitals = await db.query.patientVitals.findFirst({
    where: eq(patientVitals.patientUserId, patientUserId),
    orderBy: [desc(patientVitals.measuredAt)],
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysDashboard = await db.query.patientDailyDashboards.findFirst({
    where: and(eq(patientDailyDashboards.patientUserId, patientUserId), eq(patientDailyDashboards.date, today)),
  });

  const recentLabs = await db.query.patientLabResults.findMany({
    where: eq(patientLabResults.patientUserId, patientUserId),
    orderBy: [desc(patientLabResults.collectedAt)],
    limit: 5,
  });

  const meds = await db.query.patientMedications.findMany({
    where: eq(patientMedications.patientUserId, patientUserId),
    orderBy: [desc(patientMedications.notedAt)],
    limit: 5,
  });

  const conditions = await db.query.patientConditions.findMany({
    where: eq(patientConditions.patientUserId, patientUserId),
    orderBy: [desc(patientConditions.notedAt)],
    limit: 5,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Patient overview</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Patient ID: <span className="font-mono text-xs">{patientUserId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/physician/patients/${patientUserId}/map`}
            className="px-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Health Map
          </Link>
          <Link
            href={`/physician/chat/${patientUserId}`}
            className="px-3 py-2 text-sm rounded bg-zinc-900 text-white dark:bg-white dark:text-black"
          >
            Chat about patient
          </Link>
        </div>
      </div>

      <PhysicianPatientDataEntry patientUserId={patientUserId} />

      <DailyDashboardCard
        patientUserId={patientUserId}
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
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Documents</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload labs/reports for this patient. Parsed data will be visible to the patient too.
          </p>
        </div>
        <DocumentManager patientUserId={patientUserId} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <h2 className="text-sm font-semibold">Basics</h2>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Age: {profile?.ageYears ?? "—"}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Gender: {profile?.gender ?? "—"}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <h2 className="text-sm font-semibold">Latest vitals</h2>
          {latestVitals ? (
            <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                BP:{" "}
                {latestVitals.systolic && latestVitals.diastolic
                  ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                  : "—"}
              </div>
              <div>HR: {latestVitals.heartRate ? `${latestVitals.heartRate} bpm` : "—"}</div>
              <div>
                Temp: {latestVitals.temperatureC ? `${latestVitals.temperatureC}°C` : "—"}
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">No vitals yet.</div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <h2 className="text-sm font-semibold">Recent labs</h2>
          {recentLabs.length ? (
            <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {recentLabs.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{l.testName}</span>
                  <span>
                    {l.valueText}
                    {l.unit ? ` ${l.unit}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">No labs yet.</div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Medications</h2>
            {meds.length ? (
              <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                {meds.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {m.medicationName}
                    </span>
                    <span>{m.dose ?? "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">None listed.</div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold">Conditions</h2>
            {conditions.length ? (
              <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                {conditions.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {c.conditionName}
                    </span>
                    <span>{c.status ?? "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">None listed.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}


