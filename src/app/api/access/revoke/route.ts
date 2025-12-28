import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { revokePatientPhysicianAccess } from "@/server/invites/service";

export const runtime = "nodejs";

const RevokeAccessSchema = z.object({
  physicianUserId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = RevokeAccessSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Patient revokes access to their data.
    await revokePatientPhysicianAccess({
      patientUserId: user.id,
      physicianUserId: parsed.data.physicianUserId,
    });

    return NextResponse.json({ ok: true });
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
    console.error("/api/access/revoke POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


