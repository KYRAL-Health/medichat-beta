import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { patientConditions } from "@/server/db/schema";

export const runtime = "nodejs";

const ConditionSchema = z.object({
  conditionName: z.string().min(1).max(200),
  status: z.string().max(100).nullable().optional(),
  notedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = ConditionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const c = parsed.data;
    const notedAt = c.notedAt ? new Date(c.notedAt) : new Date();

    const created = await db
      .insert(patientConditions)
      .values({
        patientUserId: user.id,
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
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    console.error("/api/patient/conditions POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


