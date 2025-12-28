import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { userMemories } from "@/server/db/schema";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuthenticatedUser();

    const updated = await db
      .update(userMemories)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(
        and(
          eq(userMemories.id, id),
          eq(userMemories.ownerUserId, user.id),
          eq(userMemories.status, "proposed")
        )
      )
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      return NextResponse.json({ error: "MEMORY_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, memory: updated });
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
    console.error("/api/memories/[id]/accept POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
