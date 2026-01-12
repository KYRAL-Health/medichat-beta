import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { db } from "@/server/db";
import { patientMedications } from "@/server/db/schema";

export const runtime = "nodejs";

const MedicationSchema = z.object({
  medicationName: z.string().min(1).max(200),
  dose: z.string().max(100).nullable().optional(),
  frequency: z.string().max(100).nullable().optional(),
  active: z.boolean().optional(),
  notedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const parsed = MedicationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const m = parsed.data;
    const notedAt = m.notedAt ? new Date(m.notedAt) : new Date();

    const created = await db
      .insert(patientMedications)
      .values({
        patientUserId: userId,
        medicationName: m.medicationName,
        dose: m.dose ?? null,
        frequency: m.frequency ?? null,
        active: m.active ?? true,
        notedAt,
      })
      .returning()
      .then((rows) => rows[0]);

    return NextResponse.json({ ok: true, medication: created }, { status: 201 });
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
    console.error("/api/patient/medications POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


