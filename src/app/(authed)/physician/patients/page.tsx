import { and, eq, isNull } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { db } from "@/server/db";
import {
  patientDailyDashboards,
  patientPhysicianAccess,
  patientProfiles,
  userProfiles,
  users,
} from "@/server/db/schema";
import { PatientListClient } from "@/components/PatientListClient";

export default async function PhysicianPatientsPage() {
  let physicianUserId: string;
  try {
    physicianUserId = (await requireAuthenticatedUser()).userId;
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
      patientClerkUserId: users.clerkUserId,
      displayName: userProfiles.displayName,
      ageYears: patientProfiles.ageYears,
      gender: patientProfiles.gender,
      dashboardJson: patientDailyDashboards.dashboardJson,
    })
    .from(patientPhysicianAccess)
    .innerJoin(users, eq(patientPhysicianAccess.patientUserId, users.clerkUserId))
    .leftJoin(userProfiles, eq(userProfiles.userId, patientPhysicianAccess.patientUserId))
    .leftJoin(
      patientProfiles,
      eq(patientProfiles.patientUserId, patientPhysicianAccess.patientUserId)
    )
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

  const patients = rows.map((p) => ({
    patientUserId: p.patientUserId,
    patientClerkUserId: p.patientClerkUserId,
    displayName: p.displayName,
    ageYears: p.ageYears,
    gender: p.gender,
    overview:
      typeof p.dashboardJson === "object" && p.dashboardJson
        ? ((p.dashboardJson as { overview?: string }).overview ?? null)
        : null,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Patients</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Overview of patients under your care.
        </p>
      </div>

      <PatientListClient patients={patients} />
    </div>
  );
}
