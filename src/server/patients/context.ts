import { desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  patientConditions,
  patientLabResults,
  patientMedications,
  patientProfiles,
  patientVitals,
} from "@/server/db/schema";

export async function buildPatientContext(patientUserId: string) {
  const profile = await db.query.patientProfiles.findFirst({
    where: eq(patientProfiles.patientUserId, patientUserId),
  });

  const latestVitals = await db.query.patientVitals.findFirst({
    where: eq(patientVitals.patientUserId, patientUserId),
    orderBy: [desc(patientVitals.measuredAt)],
  });

  const labs = await db.query.patientLabResults.findMany({
    where: eq(patientLabResults.patientUserId, patientUserId),
    orderBy: [desc(patientLabResults.collectedAt)],
    limit: 8,
  });

  const meds = await db.query.patientMedications.findMany({
    where: eq(patientMedications.patientUserId, patientUserId),
    orderBy: [desc(patientMedications.notedAt)],
    limit: 8,
  });

  const conditions = await db.query.patientConditions.findMany({
    where: eq(patientConditions.patientUserId, patientUserId),
    orderBy: [desc(patientConditions.notedAt)],
    limit: 8,
  });

  return {
    profile,
    latestVitals,
    labs,
    meds,
    conditions,
  };
}

export function stringifyPatientContext(ctx: Awaited<ReturnType<typeof buildPatientContext>>) {
  const parts: string[] = [];
  parts.push("PatientContext");
  if (ctx.profile) {
    parts.push(
      `Demographics: ageYears=${ctx.profile.ageYears ?? "unknown"}, gender=${ctx.profile.gender}`
    );
    if (ctx.profile.smokingStatus) parts.push(`Smoking: ${ctx.profile.smokingStatus}`);
    if (ctx.profile.alcoholConsumption) parts.push(`Alcohol: ${ctx.profile.alcoholConsumption}`);
    if (ctx.profile.physicalActivityLevel)
      parts.push(`Activity: ${ctx.profile.physicalActivityLevel}`);
    if (ctx.profile.historyOfPresentIllness)
      parts.push(`HPI: ${ctx.profile.historyOfPresentIllness}`);
    if (ctx.profile.symptomOnset) parts.push(`SymptomOnset: ${ctx.profile.symptomOnset}`);
    if (ctx.profile.symptomDuration) parts.push(`SymptomDuration: ${ctx.profile.symptomDuration}`);
  } else {
    parts.push("Profile: none");
  }

  if (ctx.latestVitals) {
    parts.push(
      `LatestVitals: measuredAt=${ctx.latestVitals.measuredAt.toISOString()}, BP=${ctx.latestVitals.systolic ?? "?"}/${ctx.latestVitals.diastolic ?? "?"}, HR=${ctx.latestVitals.heartRate ?? "?"}, TempC=${ctx.latestVitals.temperatureC ?? "?"}`
    );
  } else {
    parts.push("LatestVitals: none");
  }

  if (ctx.conditions.length) {
    parts.push(`Conditions: ${ctx.conditions.map((c) => c.conditionName).join(", ")}`);
  } else {
    parts.push("Conditions: none");
  }

  if (ctx.meds.length) {
    parts.push(`Medications: ${ctx.meds.map((m) => m.medicationName).join(", ")}`);
  } else {
    parts.push("Medications: none");
  }

  if (ctx.labs.length) {
    parts.push(
      `RecentLabs: ${ctx.labs
        .map((l) => `${l.testName}=${l.valueText}${l.unit ? l.unit : ""}`)
        .join("; ")}`
    );
  } else {
    parts.push("RecentLabs: none");
  }

  return parts.join("\n");
}


