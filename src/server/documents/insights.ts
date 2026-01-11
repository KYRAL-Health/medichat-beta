import { and, desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  documentExtractions,
  documents,
  patientConditions,
  patientLabResults,
  patientMedications,
  patientVitals,
} from "@/server/db/schema";

export async function getDocumentInsightsData(documentId: string) {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });
  if (!doc) return null;

  // Latest extraction payload (if any).
  const extraction = await db.query.documentExtractions.findFirst({
    where: eq(documentExtractions.documentId, doc.id),
    orderBy: [desc(documentExtractions.createdAt)],
  });

  // Records created from this document (via sourceDocumentId).
  const vitals = await db.query.patientVitals.findMany({
    where: and(
      eq(patientVitals.patientUserId, doc.patientUserId),
      eq(patientVitals.sourceDocumentId, doc.id)
    ),
    orderBy: [desc(patientVitals.measuredAt)],
    limit: 50,
  });

  const labs = await db.query.patientLabResults.findMany({
    where: and(
      eq(patientLabResults.patientUserId, doc.patientUserId),
      eq(patientLabResults.sourceDocumentId, doc.id)
    ),
    orderBy: [desc(patientLabResults.collectedAt)],
    limit: 50,
  });

  const medications = await db.query.patientMedications.findMany({
    where: and(
      eq(patientMedications.patientUserId, doc.patientUserId),
      eq(patientMedications.sourceDocumentId, doc.id)
    ),
    orderBy: [desc(patientMedications.notedAt)],
    limit: 50,
  });

  const conditions = await db.query.patientConditions.findMany({
    where: and(
      eq(patientConditions.patientUserId, doc.patientUserId),
      eq(patientConditions.sourceDocumentId, doc.id)
    ),
    orderBy: [desc(patientConditions.notedAt)],
    limit: 50,
  });

  return {
    document: doc,
    extraction,
    created: { vitals, labs, medications, conditions },
  };
}


