import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { patientPhysicianAccess, users } from "@/server/db/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();

    const rows = await db
      .select({
        physicianUserId: patientPhysicianAccess.physicianUserId,
        physicianWalletAddress: users.walletAddress,
        createdAt: patientPhysicianAccess.createdAt,
      })
      .from(patientPhysicianAccess)
      .innerJoin(users, eq(patientPhysicianAccess.physicianUserId, users.id))
      .where(
        and(eq(patientPhysicianAccess.patientUserId, user.id), isNull(patientPhysicianAccess.revokedAt))
      );

    return NextResponse.json({ physicians: rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "DATABASE_NOT_AVAILABLE") {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    console.error("/api/patient/access GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


