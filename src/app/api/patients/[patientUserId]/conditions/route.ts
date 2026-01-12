import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { patientConditions } from "@/server/db/schema";

export const runtime = "nodejs";

const ConditionSchema = z.object({
  conditionName: z.string().min(1).max(200),
  status: z.string().max(100).nullable().optional(),
  notedAt: z.string().datetime().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ patientUserId: string }> }
) {
  try {
    const { patientUserId } = await params;
    const { userId } = await requireAuthenticatedUser();
    await assertPatientAccess({ viewerUserId: userId, patientUserId });

    const parsed = ConditionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const c = parsed.data;
    const notedAt = c.notedAt ? new Date(c.notedAt) : new Date();

    const created = await db
      .insert(patientConditions)
      .values({
        patientUserId,
        conditionName: c.conditionName,
        status: c.status ?? null,
        notedAt,
      })
      .returning()
      .then((rows) => rows[0]);

    return NextResponse.json({ ok: true, condition: created }, { status: 201 });
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
    console.error("/api/patients/[patientUserId]/conditions POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


