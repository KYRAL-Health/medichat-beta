import { db } from "@/server/db";
import {
  documentExtractions,
  patientConditions,
  patientLabResults,
  patientMedications,
  patientProfiles,
  patientVitals,
} from "@/server/db/schema";
import { type z } from "zod";
import { DocumentExtractionSchema } from "@/server/documents/extractStructured";

type Extracted = z.infer<typeof DocumentExtractionSchema>;

function parseDateOrNull(value: string | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeGender(value: string | undefined) {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (v === "female" || v === "f") return "female";
  if (v === "male" || v === "m") return "male";
  if (v === "nonbinary" || v === "non-binary") return "nonbinary";
  if (v === "other") return "other";
  if (v === "unknown") return "unknown";
  return null;
}

export async function ingestDocumentExtraction(args: {
  patientUserId: string;
  documentId: string;
  model: string;
  extracted: Extracted;
  rawJson: unknown;
}) {
  const now = new Date();

  await db.transaction(async (tx) => {
    // Record extraction payload
    await tx.insert(documentExtractions).values({
      documentId: args.documentId,
      model: args.model,
      extractedJson: args.rawJson as Record<string, unknown>,
    });

    const updates: Partial<typeof patientProfiles.$inferInsert> = {};
    const demographics = args.extracted.demographics;
    const hpi = args.extracted.hpi;

    if (demographics?.ageYears != null) updates.ageYears = Math.trunc(demographics.ageYears);
    const gender = normalizeGender(demographics?.gender);
    if (gender) updates.gender = gender;
    if (hpi?.historyOfPresentIllness) updates.historyOfPresentIllness = hpi.historyOfPresentIllness;
    if (hpi?.symptomOnset) updates.symptomOnset = hpi.symptomOnset;
    if (hpi?.symptomDuration) updates.symptomDuration = hpi.symptomDuration;

    if (Object.keys(updates).length) {
      await tx
        .insert(patientProfiles)
        .values({
          patientUserId: args.patientUserId,
          ...updates,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [patientProfiles.patientUserId],
          set: {
            ...updates,
            updatedAt: now,
          },
        });
    }

    for (const v of args.extracted.vitals ?? []) {
      await tx.insert(patientVitals).values({
        patientUserId: args.patientUserId,
        measuredAt: parseDateOrNull(v.measuredAt) ?? now,
        systolic: v.systolic != null ? Math.trunc(v.systolic) : null,
        diastolic: v.diastolic != null ? Math.trunc(v.diastolic) : null,
        heartRate: v.heartRate != null ? Math.trunc(v.heartRate) : null,
        temperatureC: v.temperatureC != null ? Math.trunc(v.temperatureC) : null,
        sourceDocumentId: args.documentId,
      });
    }

    for (const l of args.extracted.labs ?? []) {
      await tx.insert(patientLabResults).values({
        patientUserId: args.patientUserId,
        collectedAt: parseDateOrNull(l.collectedAt) ?? now,
        testName: l.testName,
        valueText: l.valueText,
        unit: l.unit ?? null,
        referenceRange: l.referenceRange ?? null,
        flag: l.flag ?? null,
        sourceDocumentId: args.documentId,
      });
    }

    for (const m of args.extracted.medications ?? []) {
      await tx.insert(patientMedications).values({
        patientUserId: args.patientUserId,
        medicationName: m.medicationName,
        dose: m.dose ?? null,
        frequency: m.frequency ?? null,
        active: m.active ?? true,
        notedAt: now,
        sourceDocumentId: args.documentId,
      });
    }

    for (const c of args.extracted.conditions ?? []) {
      await tx.insert(patientConditions).values({
        patientUserId: args.patientUserId,
        conditionName: c.conditionName,
        status: c.status ?? null,
        notedAt: now,
        sourceDocumentId: args.documentId,
      });
    }
  });
}


