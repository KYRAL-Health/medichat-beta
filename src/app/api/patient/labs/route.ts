import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { patientLabResults } from "@/server/db/schema";

export const runtime = "nodejs";

const LabSchema = z.object({
  collectedAt: z.string().datetime().optional(),
  testName: z.string().min(1).max(200),
  valueText: z.string().min(1).max(200),
  valueNum: z.number().int().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  referenceRange: z.string().max(100).nullable().optional(),
  flag: z.string().max(50).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = LabSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const l = parsed.data;
    const collectedAt = l.collectedAt ? new Date(l.collectedAt) : new Date();

    const created = await db
      .insert(patientLabResults)
      .values({
        patientUserId: user.id,
        collectedAt,
        testName: l.testName,
        valueText: l.valueText,
        valueNum: l.valueNum ?? null,
        unit: l.unit ?? null,
        referenceRange: l.referenceRange ?? null,
        flag: l.flag ?? null,
      })
      .returning()
      .then((rows) => rows[0]);

    return NextResponse.json({ ok: true, lab: created }, { status: 201 });
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
    console.error("/api/patient/labs POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


