import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { acceptAccessInvite } from "@/server/invites/service";

export const runtime = "nodejs";

const AcceptInviteSchema = z.object({
  token: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    const parsed = AcceptInviteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await acceptAccessInvite({
      token: parsed.data.token,
      acceptorUserId: user.id,
    });

    return NextResponse.json({ ok: true, ...result });
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
    if (
      msg === "INVITE_NOT_FOUND" ||
      msg === "INVITE_REVOKED" ||
      msg === "INVITE_ALREADY_ACCEPTED" ||
      msg === "INVITE_EXPIRED" ||
      msg === "INVITE_SELF_NOT_ALLOWED"
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    console.error("/api/invites/accept POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


