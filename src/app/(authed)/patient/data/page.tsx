import { eq } from "drizzle-orm";

import { PatientDataForm } from "@/components/PatientDataForm";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { userProfiles } from "@/server/db/schema";

export default async function PatientDataPage() {
  let userId: string;
  try {
    const user = await requireAuthenticatedUser();
    userId = user.id;
  } catch (e) {
    return <div>Error loading user</div>;
  }

  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">My data</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add your baseline history and day-to-day vitals/labs/meds/conditions.
        </p>
      </div>

      <PatientDataForm 
        patientUserId={userId} 
        initialName={userProfile?.displayName ?? null} 
      />
    </div>
  );
}
