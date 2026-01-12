import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { db } from "@/server/db";
import { patientRecordSuggestions } from "@/server/db/schema";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await requireAuthenticatedUser();

    const updated = await db
      .update(patientRecordSuggestions)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(patientRecordSuggestions.id, id),
          eq(patientRecordSuggestions.patientUserId, userId),
          eq(patientRecordSuggestions.status, "proposed")
        )
      )
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      return NextResponse.json({ error: "SUGGESTION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("/api/suggestions/[id]/reject POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


