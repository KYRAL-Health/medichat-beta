import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { accessInvites, users } from "@/server/db/schema";
import { hashInviteToken } from "@/server/invites/tokens";
import { getInviteStatus } from "@/server/invites/service";
import { InviteAcceptClient } from "@/components/InviteAcceptClient";

function kindLabel(kind: string) {
  if (kind === "patientInvitesPhysician") return "Patient invites physician";
  if (kind === "physicianInvitesPatient") return "Physician invites patient";
  return kind;
}

function kindExplanation(kind: string) {
  if (kind === "patientInvitesPhysician") {
    return "Accepting will grant your account physician access to the patient’s data.";
  }
  if (kind === "physicianInvitesPatient") {
    return "Accepting will grant the physician access to your data (you are the patient in this invite).";
  }
  return "Accepting will create a patient↔physician access link.";
}

export default async function InvitePage({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}) {
  const { token } = await params;

  try {
    await requireAuthenticatedUser();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") {
      redirect(`/auth?returnTo=${encodeURIComponent(`/invite/${token}`)}`);
    }
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Invite</h1>
        <p className="text-sm text-red-700 dark:text-red-200">
          Unable to load invite: {msg || "Unknown error"}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This feature requires a configured database.
        </p>
      </div>
    );
  }

  const tokenHash = hashInviteToken(token);

  const inviteRow = await db
    .select({
      id: accessInvites.id,
      kind: accessInvites.kind,
      inviterUserId: accessInvites.inviterUserId,
      inviterWalletAddress: users.walletAddress,
      expiresAt: accessInvites.expiresAt,
      revokedAt: accessInvites.revokedAt,
      acceptedAt: accessInvites.acceptedAt,
      createdAt: accessInvites.createdAt,
    })
    .from(accessInvites)
    .innerJoin(users, eq(accessInvites.inviterUserId, users.id))
    .where(eq(accessInvites.tokenHash, tokenHash))
    .then((rows) => rows[0] ?? null);

  if (!inviteRow) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Invite</h1>
        <p className="text-sm text-red-700 dark:text-red-200">Invite not found.</p>
        <Link className="underline text-sm" href="/">
          Go home
        </Link>
      </div>
    );
  }

  const status = getInviteStatus(inviteRow);
  const actionable = status === "active";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Invite link</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {kindLabel(inviteRow.kind)} · Status:{" "}
          <span className={actionable ? "text-green-700 dark:text-green-300" : ""}>
            {status}
          </span>
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
        <div className="text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Inviter:</span>{" "}
          <span className="font-mono text-xs">{inviteRow.inviterWalletAddress}</span>
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {kindExplanation(inviteRow.kind)}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-500">
          Expires: {inviteRow.expiresAt.toLocaleString()}
        </div>
      </section>

      <InviteAcceptClient token={token} disabled={!actionable} />
    </div>
  );
}


