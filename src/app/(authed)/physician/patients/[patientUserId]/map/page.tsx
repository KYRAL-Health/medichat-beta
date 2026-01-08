import { and, desc, eq } from "drizzle-orm";

import { HealthMapClient } from "@/components/HealthMapClient";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import {
  documents,
  patientConditions,
  patientLabResults,
  patientMedications,
  patientVitals,
  userMemories,
} from "@/server/db/schema";

export default async function PhysicianPatientMapPage({
  params,
}: {
  params:
    | { patientUserId: string }
    | Promise<{ patientUserId: string }>;
}) {
  const { patientUserId } = await params;

  const physician = await requireAuthenticatedUser();
  await assertPatientAccess({ viewerUserId: physician.id, patientUserId });

  const docs = await db.query.documents.findMany({
    where: eq(documents.patientUserId, patientUserId),
    orderBy: [desc(documents.createdAt)],
    limit: 20,
  });

  const labs = await db.query.patientLabResults.findMany({
    where: eq(patientLabResults.patientUserId, patientUserId),
    orderBy: [desc(patientLabResults.collectedAt)],
    limit: 250,
  });

  const vitals = await db.query.patientVitals.findMany({
    where: eq(patientVitals.patientUserId, patientUserId),
    orderBy: [desc(patientVitals.measuredAt)],
    limit: 250,
  });

  const meds = await db.query.patientMedications.findMany({
    where: eq(patientMedications.patientUserId, patientUserId),
    orderBy: [desc(patientMedications.notedAt)],
    limit: 250,
  });

  const conditions = await db.query.patientConditions.findMany({
    where: eq(patientConditions.patientUserId, patientUserId),
    orderBy: [desc(patientConditions.notedAt)],
    limit: 250,
  });

  const memories = await db.query.userMemories.findMany({
    where: and(
      eq(userMemories.ownerUserId, physician.id),
      eq(userMemories.status, "accepted"),
      eq(userMemories.contextMode, "physician"),
      eq(userMemories.subjectPatientUserId, patientUserId)
    ),
    orderBy: [desc(userMemories.acceptedAt), desc(userMemories.createdAt)],
    limit: 20,
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Health Map</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Provenance view for Patient{" "}
          <span className="font-mono text-xs">{patientUserId}</span>.
        </p>
      </div>

      <HealthMapClient
        mode="physician"
        patientUserId={patientUserId}
        documents={docs.map((d) => ({
          id: d.id,
          originalFileName: d.originalFileName,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
        }))}
        labs={labs.map((l) => ({
          id: l.id,
          testName: l.testName,
          flag: l.flag,
          collectedAt: l.collectedAt.toISOString(),
          sourceDocumentId: l.sourceDocumentId,
        }))}
        vitals={vitals.map((v) => ({
          id: v.id,
          measuredAt: v.measuredAt.toISOString(),
          systolic: v.systolic,
          diastolic: v.diastolic,
          heartRate: v.heartRate,
          temperatureC: v.temperatureC,
          sourceDocumentId: v.sourceDocumentId,
        }))}
        medications={meds.map((m) => ({
          id: m.id,
          medicationName: m.medicationName,
          active: m.active,
          notedAt: m.notedAt.toISOString(),
          sourceDocumentId: m.sourceDocumentId,
        }))}
        conditions={conditions.map((c) => ({
          id: c.id,
          conditionName: c.conditionName,
          status: c.status,
          notedAt: c.notedAt.toISOString(),
          sourceDocumentId: c.sourceDocumentId,
        }))}
        memories={memories.map((m) => ({
          id: m.id,
          memoryText: m.memoryText,
          category: m.category,
          acceptedAt: m.acceptedAt ? m.acceptedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}



