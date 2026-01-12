import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getBucketName, putObject } from "@/server/storage/s3";

export const runtime = "nodejs";

const PatientUserIdSchema = z.string();

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+\s]/g, "_").slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    const form = await req.formData();
    const file = form.get("file");
    const patientUserIdRaw = form.get("patientUserId");

    const patientUserId =
      typeof patientUserIdRaw === "string" && patientUserIdRaw
        ? PatientUserIdSchema.parse(patientUserIdRaw)
        : userId;

      if (patientUserId !== userId) {
        await assertPatientAccess({ viewerUserId: userId, patientUserId });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const contentType = file.type || "application/octet-stream";
    const originalFileName = sanitizeFileName(file.name || "document");
    const sizeBytes = file.size;

    const buffer = Buffer.from(await file.arrayBuffer());

    const bucket = getBucketName();
    const objectKey = `${patientUserId}/${crypto.randomUUID()}-${originalFileName}`;

    const created = await db
      .insert(documents)
      .values({
        patientUserId,
        uploadedByUserId: userId,
        originalFileName,
        contentType,
        sizeBytes,
        bucket,
        objectKey,
        status: "uploaded",
      })
      .returning()
      .then((rows) => rows[0]);

    if (!created) {
      return NextResponse.json({ error: "DOCUMENT_CREATE_FAILED" }, { status: 500 });
    }

    try {
      await putObject({
        key: objectKey,
        body: buffer,
        contentType,
      });
    } catch (uploadError) {
      await db
        .update(documents)
        .set({
          status: "error",
          parseError: "UPLOAD_FAILED",
        })
        .where(eq(documents.id, created.id));

      throw uploadError;
    }

    return NextResponse.json({ ok: true, document: created });
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
    console.error("/api/documents/upload POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


