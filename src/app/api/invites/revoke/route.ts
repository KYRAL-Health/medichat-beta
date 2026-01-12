import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { revokeAccessInvite } from "@/server/invites/service";

export const runtime = "nodejs";

const RevokeInviteSchema = z.object({
  inviteId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const parsed = RevokeInviteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await revokeAccessInvite({ inviteId: parsed.data.inviteId, requesterUserId: userId });
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

    const msg = error instanceof Error ? error.message : "UNKNOWN";
    if (msg === "INVITE_NOT_FOUND" || msg === "INVITE_FORBIDDEN") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    console.error("/api/invites/revoke POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


