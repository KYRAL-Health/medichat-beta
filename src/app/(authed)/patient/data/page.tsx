import { eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { userProfiles } from "@/server/db/schema";
import { PatientDataPageClient } from "@/components/PatientDataPageClient";

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
    <PatientDataPageClient 
      userId={userId} 
      initialName={userProfile?.displayName ?? null} 
    />
  );
}
