import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { db } from "@/server/db";
import {
  patientProfiles,
  patientProfileHistory,
  smokingStatusEnum,
  alcoholConsumptionEnum,
  physicalActivityEnum,
  genderEnum,
} from "@/server/db/schema";

export const runtime = "nodejs";

const ProfileSchema = z.object({
  ageYears: z.number().int().min(0).max(130).nullable().optional(),
  gender: z.enum(genderEnum.enumValues).optional(),
  historyOfPresentIllness: z.string().max(5000).nullable().optional(),
  symptomOnset: z.string().max(2000).nullable().optional(),
  symptomDuration: z.string().max(2000).nullable().optional(),
  smokingStatus: z.enum(smokingStatusEnum.enumValues).optional(),
  alcoholConsumption: z.enum(alcoholConsumptionEnum.enumValues).optional(),
  physicalActivityLevel: z.enum(physicalActivityEnum.enumValues).optional(),
});

export async function GET() {
  try {
    const { userId } = await requireAuthenticatedUser();
    const profile = await db.query.patientProfiles.findFirst({
      where: eq(patientProfiles.patientUserId, userId),
    });
    return NextResponse.json({ profile: profile ?? null });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "DATABASE_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    console.error("/api/patient/profile GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    const parsed = ProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const values = parsed.data;

    // Transaction: 
    // 1. Close current history record (if any)
    // 2. Insert new history record
    // 3. Update main profile
    
    await db.transaction(async (tx) => {
      // 1. Find the latest valid history record to close it
      const latestHistory = await tx.query.patientProfileHistory.findFirst({
        where: eq(patientProfileHistory.patientUserId, userId),
        orderBy: [desc(patientProfileHistory.validFrom)],
      });

      if (latestHistory && !latestHistory.validTo) {
        await tx
          .update(patientProfileHistory)
          .set({ validTo: new Date() })
          .where(eq(patientProfileHistory.id, latestHistory.id));
      }

      // 2. Insert new history record
      await tx.insert(patientProfileHistory).values({
        patientUserId: userId,
        ...values,
        // Defaults for required enums if not provided (though form usually provides them)
        gender: values.gender ?? "unknown",
        smokingStatus: values.smokingStatus ?? "unknown",
        alcoholConsumption: values.alcoholConsumption ?? "unknown",
        physicalActivityLevel: values.physicalActivityLevel ?? "unknown",
        validFrom: new Date(),
      });

      // 3. Update/Upsert main profile (current state)
      await tx
        .insert(patientProfiles)
        .values({
          patientUserId: userId,
          ...values,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [patientProfiles.patientUserId],
          set: {
            ...values,
            updatedAt: new Date(),
          },
        });
    });

    // Return the updated profile
    const saved = await db.query.patientProfiles.findFirst({
      where: eq(patientProfiles.patientUserId, userId),
    });

    return NextResponse.json({ ok: true, profile: saved });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "DATABASE_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    console.error("/api/patient/profile PUT error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
