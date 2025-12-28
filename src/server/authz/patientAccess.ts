import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { patientPhysicianAccess } from "@/server/db/schema";

export class PatientAccessError extends Error {
  constructor(message: "FORBIDDEN_PATIENT_ACCESS") {
    super(message);
  }
}

export async function canAccessPatient(args: {
  viewerUserId: string;
  patientUserId: string;
}): Promise<boolean> {
  const { viewerUserId, patientUserId } = args;
  if (viewerUserId === patientUserId) return true;

  const row = await db.query.patientPhysicianAccess.findFirst({
    where: and(
      eq(patientPhysicianAccess.patientUserId, patientUserId),
      eq(patientPhysicianAccess.physicianUserId, viewerUserId),
      isNull(patientPhysicianAccess.revokedAt)
    ),
  });

  return Boolean(row);
}

export async function assertPatientAccess(args: {
  viewerUserId: string;
  patientUserId: string;
}) {
  const ok = await canAccessPatient(args);
  if (!ok) {
    throw new PatientAccessError("FORBIDDEN_PATIENT_ACCESS");
  }
}


