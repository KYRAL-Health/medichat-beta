import { InviteLinks } from "@/components/InviteLinks";
import { AccessList } from "@/components/AccessList";

export default function PatientSharingPage() {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Sharing</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create invite links for physicians to access your data, view active access, and
          revoke access.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <InviteLinks
            kind="patientInvitesPhysician"
            title="Invite a physician"
            description="Create a link that a physician can open to gain access to your data."
          />
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
          <AccessList />
        </div>
      </div>
    </div>
  );
}


