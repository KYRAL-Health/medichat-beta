import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import {
  documentExtractions,
  documents,
  patientConditions,
  patientLabResults,
  patientMedications,
  patientVitals,
} from "@/server/db/schema";

export const runtime = "nodejs";

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
      await assertPatientAccess({
        viewerUserId: user.id,
        patientUserId: doc.patientUserId,
      });
    }

    // Latest extraction payload (if any).
    const extraction = await db.query.documentExtractions.findFirst({
      where: eq(documentExtractions.documentId, doc.id),
      orderBy: [desc(documentExtractions.createdAt)],
    });

    // Records created from this document (via sourceDocumentId).
    const vitals = await db.query.patientVitals.findMany({
      where: and(
        eq(patientVitals.patientUserId, doc.patientUserId),
        eq(patientVitals.sourceDocumentId, doc.id)
      ),
      orderBy: [desc(patientVitals.measuredAt)],
      limit: 200,
    });

    const labs = await db.query.patientLabResults.findMany({
      where: and(
        eq(patientLabResults.patientUserId, doc.patientUserId),
        eq(patientLabResults.sourceDocumentId, doc.id)
      ),
      orderBy: [desc(patientLabResults.collectedAt)],
      limit: 400,
    });

    const medications = await db.query.patientMedications.findMany({
      where: and(
        eq(patientMedications.patientUserId, doc.patientUserId),
        eq(patientMedications.sourceDocumentId, doc.id)
      ),
      orderBy: [desc(patientMedications.notedAt)],
      limit: 200,
    });

    const conditions = await db.query.patientConditions.findMany({
      where: and(
        eq(patientConditions.patientUserId, doc.patientUserId),
        eq(patientConditions.sourceDocumentId, doc.id)
      ),
      orderBy: [desc(patientConditions.notedAt)],
      limit: 200,
    });

    const url = new URL(req.url);
    const basePath = `${url.protocol}//${url.host}`;

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        patientUserId: doc.patientUserId,
        uploadedByUserId: doc.uploadedByUserId,
        originalFileName: doc.originalFileName,
        contentType: doc.contentType,
        sizeBytes: doc.sizeBytes,
        status: doc.status,
        parsedAt: doc.parsedAt,
        parseError: doc.parseError,
        createdAt: doc.createdAt,
        urls: {
          open: `${basePath}/api/documents/${doc.id}/download`,
          download: `${basePath}/api/documents/${doc.id}/download?download=1`,
        },
      },
      extraction: extraction
        ? {
            id: extraction.id,
            documentId: extraction.documentId,
            model: extraction.model,
            extractedJson: extraction.extractedJson,
            createdAt: extraction.createdAt,
          }
        : null,
      created: { vitals, labs, medications, conditions },
    });
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
    if (error instanceof Error && error.message === "FORBIDDEN_PATIENT_ACCESS") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("/api/documents/[id]/insights GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


