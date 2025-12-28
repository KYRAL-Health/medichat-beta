import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  alcoholConsumptionEnum,
  genderEnum,
  patientProfiles,
  physicalActivityEnum,
  smokingStatusEnum,
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
    const user = await requireAuthenticatedUser();
    const profile = await db.query.patientProfiles.findFirst({
      where: eq(patientProfiles.patientUserId, user.id),
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
    const user = await requireAuthenticatedUser();

    const parsed = ProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const values = parsed.data;

    const saved = await db
      .insert(patientProfiles)
      .values({
        patientUserId: user.id,
        ...values,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [patientProfiles.patientUserId],
        set: {
          ...values,
          updatedAt: new Date(),
        },
      })
      .returning()
      .then((rows) => rows[0]);

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


