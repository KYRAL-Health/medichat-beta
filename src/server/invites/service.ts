import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { accessInvites, patientPhysicianAccess } from "@/server/db/schema";
import { hashInviteToken } from "@/server/invites/tokens";

export type InviteKind = (typeof accessInvites.kind.enumValues)[number];

export type InviteStatus = "active" | "accepted" | "revoked" | "expired";

export function getInviteStatus(invite: {
  expiresAt: Date;
  revokedAt: Date | null;
  acceptedAt: Date | null;
}): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}

export async function createAccessInvite(args: {
  inviterUserId: string;
  kind: InviteKind;
  token: string;
  expiresAt: Date;
}) {
  const tokenHash = hashInviteToken(args.token);

  const invite = await db
    .insert(accessInvites)
    .values({
      inviterUserId: args.inviterUserId,
      kind: args.kind,
      tokenHash,
      expiresAt: args.expiresAt,
    })
    .returning()
    .then((rows) => rows[0]);

  return { invite };
}

export async function acceptAccessInvite(args: { token: string; acceptorUserId: string }) {
  const tokenHash = hashInviteToken(args.token);

  return db.transaction(async (tx) => {
    const invite = await tx.query.accessInvites.findFirst({
      where: eq(accessInvites.tokenHash, tokenHash),
    });

    if (!invite) {
      throw new Error("INVITE_NOT_FOUND");
    }
    if (invite.revokedAt) {
      throw new Error("INVITE_REVOKED");
    }
    if (invite.acceptedAt) {
      throw new Error("INVITE_ALREADY_ACCEPTED");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new Error("INVITE_EXPIRED");
    }

    const inviterUserId = invite.inviterUserId;
    const acceptorUserId = args.acceptorUserId;

    let patientUserId: string;
    let physicianUserId: string;

    if (invite.kind === "patientInvitesPhysician") {
      patientUserId = inviterUserId;
      physicianUserId = acceptorUserId;
    } else if (invite.kind === "physicianInvitesPatient") {
      patientUserId = acceptorUserId;
      physicianUserId = inviterUserId;
    } else {
      throw new Error("INVITE_KIND_UNSUPPORTED");
    }

    if (patientUserId === physicianUserId) {
      throw new Error("INVITE_SELF_NOT_ALLOWED");
    }

    // Create or re-activate access link.
    await tx
      .insert(patientPhysicianAccess)
      .values({
        patientUserId,
        physicianUserId,
        revokedAt: null,
      })
      .onConflictDoUpdate({
        target: [patientPhysicianAccess.patientUserId, patientPhysicianAccess.physicianUserId],
        set: { revokedAt: null },
      });

    await tx
      .update(accessInvites)
      .set({
        acceptedAt: new Date(),
        acceptedByUserId: acceptorUserId,
      })
      .where(eq(accessInvites.id, invite.id));

    return {
      inviteId: invite.id,
      kind: invite.kind,
      patientUserId,
      physicianUserId,
    };
  });
}

export async function revokeAccessInvite(args: { inviteId: string; requesterUserId: string }) {
  const invite = await db.query.accessInvites.findFirst({
    where: eq(accessInvites.id, args.inviteId),
  });

  if (!invite) {
    throw new Error("INVITE_NOT_FOUND");
  }
  if (invite.inviterUserId !== args.requesterUserId) {
    throw new Error("INVITE_FORBIDDEN");
  }
  if (invite.revokedAt) {
    return { ok: true };
  }

  await db
    .update(accessInvites)
    .set({ revokedAt: new Date() })
    .where(eq(accessInvites.id, args.inviteId));

  return { ok: true };
}

export async function revokePatientPhysicianAccess(args: {
  patientUserId: string;
  physicianUserId: string;
}) {
  await db
    .update(patientPhysicianAccess)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(patientPhysicianAccess.patientUserId, args.patientUserId),
        eq(patientPhysicianAccess.physicianUserId, args.physicianUserId),
        isNull(patientPhysicianAccess.revokedAt)
      )
    );

  return { ok: true };
}


