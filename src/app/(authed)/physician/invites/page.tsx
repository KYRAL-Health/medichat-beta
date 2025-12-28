import { InviteLinks } from "@/components/InviteLinks";

export default function PhysicianInvitesPage() {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Invites</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create an invite link for a patient to grant you access, and manage active/pending
          invites.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <InviteLinks
          kind="physicianInvitesPatient"
          title="Request access from a patient"
          description="Create a link a patient can open to grant you access to their data."
        />
      </div>
    </div>
  );
}


