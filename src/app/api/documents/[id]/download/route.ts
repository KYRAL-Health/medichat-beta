import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getObjectBuffer } from "@/server/storage/s3";

export const runtime = "nodejs";

function safeFileName(name: string) {
  // basic sanitization for Content-Disposition; keep it simple for MVP
  return name.replace(/"/g, "").replace(/\r|\n/g, "").slice(0, 180) || "document";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuthenticatedUser();
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });

    if (!doc) {
      return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    if (doc.patientUserId !== user.id) {
      await assertPatientAccess({ viewerUserId: user.id, patientUserId: doc.patientUserId });
    }

    if (!doc.objectKey) {
      return NextResponse.json({ error: "DOCUMENT_STORAGE_KEY_MISSING" }, { status: 400 });
    }

    const buf = await getObjectBuffer({ key: doc.objectKey });

    const url = new URL(req.url);
    const isDownload = url.searchParams.get("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": doc.contentType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeFileName(doc.originalFileName)}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
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
    console.error("/api/documents/[id]/download GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


