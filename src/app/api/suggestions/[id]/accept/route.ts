import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  patientConditions,
  patientLabResults,
  patientMedications,
  patientProfiles,
  patientRecordSuggestions,
  patientVitals,
} from "@/server/db/schema";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuthenticatedUser();

    // Fetch suggestion
    const suggestion = await db.query.patientRecordSuggestions.findFirst({
      where: and(
        eq(patientRecordSuggestions.id, id),
        eq(patientRecordSuggestions.patientUserId, user.id),
        eq(patientRecordSuggestions.status, "proposed")
      ),
    });

    if (!suggestion) {
      return NextResponse.json({ error: "SUGGESTION_NOT_FOUND" }, { status: 404 });
    }

    const payload = suggestion.payloadJson as Record<string, any>;
    const now = new Date();

    await db.transaction(async (tx) => {
      // 1. Apply update based on kind
      if (suggestion.kind === "profile_update") {
        await tx
          .insert(patientProfiles)
          .values({
            patientUserId: user.id,
            ...payload,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [patientProfiles.patientUserId],
            set: {
              ...payload,
              updatedAt: now,
            },
          });
      } else if (suggestion.kind === "vital") {
        await tx.insert(patientVitals).values({
          patientUserId: user.id,
          measuredAt: payload.measuredAt ? new Date(payload.measuredAt) : now,
          systolic: payload.systolic ?? null,
          diastolic: payload.diastolic ?? null,
          heartRate: payload.heartRate ?? null,
          temperatureC: payload.temperatureC ?? null,
          sourceDocumentId: null, // AI generated
        });
      } else if (suggestion.kind === "lab") {
        await tx.insert(patientLabResults).values({
          patientUserId: user.id,
          collectedAt: payload.collectedAt ? new Date(payload.collectedAt) : now,
          testName: payload.testName,
          valueText: payload.valueText,
          valueNum: payload.valueNum ?? null,
          unit: payload.unit ?? null,
          referenceRange: payload.referenceRange ?? null,
          flag: payload.flag ?? null,
          sourceDocumentId: null,
        });
      } else if (suggestion.kind === "medication") {
        await tx.insert(patientMedications).values({
          patientUserId: user.id,
          medicationName: payload.medicationName,
          dose: payload.dose ?? null,
          frequency: payload.frequency ?? null,
          active: payload.active ?? true,
          notedAt: now,
          sourceDocumentId: null,
        });
      } else if (suggestion.kind === "condition") {
        await tx.insert(patientConditions).values({
          patientUserId: user.id,
          conditionName: payload.conditionName,
          status: payload.status ?? null,
          notedAt: now,
          sourceDocumentId: null,
        });
      }

      // 2. Mark accepted
      await tx
        .update(patientRecordSuggestions)
        .set({ status: "accepted", updatedAt: now })
        .where(eq(patientRecordSuggestions.id, id));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("/api/suggestions/[id]/accept POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

