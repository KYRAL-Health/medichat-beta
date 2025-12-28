import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { accessInvites } from "@/server/db/schema";
import { createInviteToken } from "@/server/invites/tokens";
import { createAccessInvite, getInviteStatus } from "@/server/invites/service";

export const runtime = "nodejs";

const CreateInviteSchema = z.object({
  kind: z.enum(["patientInvitesPhysician", "physicianInvitesPatient"]),
});

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();

    const rows = await db.query.accessInvites.findMany({
      where: eq(accessInvites.inviterUserId, user.id),
      orderBy: [desc(accessInvites.createdAt)],
    });

    return NextResponse.json({
      invites: rows.map((i) => ({
        id: i.id,
        kind: i.kind,
        status: getInviteStatus(i),
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        acceptedAt: i.acceptedAt,
        revokedAt: i.revokedAt,
      })),
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
    console.error("/api/invites GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = CreateInviteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const token = createInviteToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const { invite } = await createAccessInvite({
      inviterUserId: user.id,
      kind: parsed.data.kind,
      token,
      expiresAt,
    });

    const inviteUrl = `${req.nextUrl.origin}/invite/${token}`;

    return NextResponse.json({
      invite: {
        id: invite.id,
        kind: invite.kind,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
      inviteUrl,
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
    console.error("/api/invites POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


