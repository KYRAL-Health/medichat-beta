import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { userProfiles } from "@/server/db/schema";

export const runtime = "nodejs";

const UpdateNameSchema = z.object({
  displayName: z.string().min(1).max(100),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { patientUserId: string } | Promise<{ patientUserId: string }> }
) {
  try {
    const { patientUserId } = await params;
    const user = await requireAuthenticatedUser();

    // Check access: caller must be the patient OR an authorized physician
    if (patientUserId !== user.id) {
      await assertPatientAccess({ viewerUserId: user.id, patientUserId });
    }

    const parsed = UpdateNameSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { displayName } = parsed.data;

    await db
      .insert(userProfiles)
      .values({
        userId: patientUserId,
        displayName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userProfiles.userId],
        set: {
          displayName,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message === "FORBIDDEN_PATIENT_ACCESS"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("/api/patients/[patientUserId]/identity PUT error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


