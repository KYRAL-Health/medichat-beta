import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { documentText, documents } from "@/server/db/schema";
import { getObjectBuffer } from "@/server/storage/s3";
import { extractTextFromFile } from "@/server/documents/extractText";
import { extractStructuredFromDocumentText } from "@/server/documents/extractStructured";
import { ingestDocumentExtraction } from "@/server/documents/ingestExtraction";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await requireAuthenticatedUser();
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });

    if (!doc) {
      return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    if (doc.patientUserId !== userId) {
      await assertPatientAccess({ viewerUserId: userId, patientUserId: doc.patientUserId });
    }

    if (!doc.objectKey) {
      return NextResponse.json({ error: "DOCUMENT_STORAGE_KEY_MISSING" }, { status: 400 });
    }

    const buf = await getObjectBuffer({ key: doc.objectKey });
    const text = await extractTextFromFile({
      fileName: doc.originalFileName,
      contentType: doc.contentType,
      buffer: buf,
    });

    if (!text) {
      await db
        .update(documents)
        .set({ status: "error", parseError: "NO_TEXT_EXTRACTED" })
        .where(eq(documents.id, doc.id));
      return NextResponse.json({ error: "NO_TEXT_EXTRACTED" }, { status: 422 });
    }

    await db
      .insert(documentText)
      .values({
        documentId: doc.id,
        extractedText: text,
      })
      .onConflictDoUpdate({
        target: [documentText.documentId],
        set: { extractedText: text },
      });

    const extracted = await extractStructuredFromDocumentText({ documentText: text });
    await ingestDocumentExtraction({
      patientUserId: doc.patientUserId,
      documentId: doc.id,
      model: extracted.model,
      extracted: extracted.extracted,
      rawJson: extracted.raw,
    });

    await db
      .update(documents)
      .set({ status: "parsed", parsedAt: new Date(), parseError: null })
      .where(eq(documents.id, doc.id));

    return NextResponse.json({ ok: true });
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

    console.error("/api/documents/[id]/parse POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


