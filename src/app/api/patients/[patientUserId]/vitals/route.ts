import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { patientVitals } from "@/server/db/schema";

export const runtime = "nodejs";

const VitalsSchema = z.object({
  measuredAt: z.string().datetime().optional(),
  systolic: z.number().int().min(0).max(400).nullable().optional(),
  diastolic: z.number().int().min(0).max(300).nullable().optional(),
  heartRate: z.number().int().min(0).max(300).nullable().optional(),
  temperatureC: z.number().int().min(0).max(100).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ patientUserId: string }> }
) {
  try {
    const { patientUserId } = await params;
    const viewer = await requireAuthenticatedUser();
    await assertPatientAccess({ viewerUserId: viewer.id, patientUserId });

    const parsed = VitalsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const v = parsed.data;
    const measuredAt = v.measuredAt ? new Date(v.measuredAt) : new Date();

    const created = await db
      .insert(patientVitals)
      .values({
        patientUserId,
        measuredAt,
        systolic: v.systolic ?? null,
        diastolic: v.diastolic ?? null,
        heartRate: v.heartRate ?? null,
        temperatureC: v.temperatureC ?? null,
      })
      .returning()
      .then((rows) => rows[0]);

    return NextResponse.json({ ok: true, vitals: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "DATABASE_NOT_AVAILABLE") {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN_PATIENT_ACCESS") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("/api/patients/[patientUserId]/vitals POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


