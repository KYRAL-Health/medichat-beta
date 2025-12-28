import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { patientDailyDashboards, patientPhysicianAccess, patientProfiles, users } from "@/server/db/schema";

export default async function PhysicianPatientsPage() {
  let physicianUserId: string;
  try {
    const user = await requireAuthenticatedUser();
    physicianUserId = user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Patients</h1>
        <p className="text-sm text-red-700 dark:text-red-200">Unable to load: {msg}</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      patientUserId: patientPhysicianAccess.patientUserId,
      walletAddress: users.walletAddress,
      ageYears: patientProfiles.ageYears,
      gender: patientProfiles.gender,
      dashboardJson: patientDailyDashboards.dashboardJson,
    })
    .from(patientPhysicianAccess)
    .innerJoin(users, eq(patientPhysicianAccess.patientUserId, users.id))
    .leftJoin(patientProfiles, eq(patientProfiles.patientUserId, patientPhysicianAccess.patientUserId))
    .leftJoin(
      patientDailyDashboards,
      and(
        eq(patientDailyDashboards.patientUserId, patientPhysicianAccess.patientUserId),
        eq(patientDailyDashboards.date, today)
      )
    )
    .where(
      and(
        eq(patientPhysicianAccess.physicianUserId, physicianUserId),
        isNull(patientPhysicianAccess.revokedAt)
      )
    );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Patients</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Bird’s-eye view of patients you have access to.
        </p>
      </div>

      {rows.length ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((p) => (
            <div key={p.patientUserId} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.walletAddress}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500 truncate">
                  Patient ID: {p.patientUserId}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500 truncate">
                  {p.ageYears ? `Age ${p.ageYears}` : "Age —"}
                  {" · "}
                  {p.gender ?? "gender —"}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                  {typeof p.dashboardJson === "object" && p.dashboardJson
                    ? ((p.dashboardJson as { overview?: string }).overview ?? "AI overview generated.")
                    : "No AI overview generated for today."}
                </div>
              </div>
              <Link
                href={`/physician/patients/${p.patientUserId}`}
                className="px-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <p className="text-sm">No patients yet.</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ask a patient to share an invite link with you, or create a request link in{" "}
            <Link className="underline" href="/physician/invites">
              Invites
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}


