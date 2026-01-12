import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const url = new URL(req.url);
    const patientUserId = url.searchParams.get("patientUserId") ?? userId;

    if (patientUserId !== userId) {
      await assertPatientAccess({ viewerUserId: userId, patientUserId });
    }

    const rows = await db.query.documents.findMany({
      where: eq(documents.patientUserId, patientUserId),
      orderBy: [desc(documents.createdAt)],
      limit: 50,
    });

    return NextResponse.json({ documents: rows });
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
    console.error("/api/documents GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


