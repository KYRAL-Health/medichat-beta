import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { getDocumentInsightsData } from "@/server/documents/insights";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuthenticatedUser();

    const data = await getDocumentInsightsData(id);
    if (!data) {
      return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    const { document: doc, extraction, created } = data;

    if (doc.patientUserId !== user.id) {
      await assertPatientAccess({
        viewerUserId: user.id,
        patientUserId: doc.patientUserId,
      });
    }

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
      created,
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
