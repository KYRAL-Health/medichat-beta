import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getAuthenticatedUser } from "@/server/auth/session";

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/auth");
  }

  // Route by mode (patient vs physician). Default: patient.
  const cookieStore = await cookies();
  const mode = cookieStore.get("medichat_mode")?.value;

  if (mode === "physician") {
    redirect("/physician/patients");
  }

  redirect("/patient/dashboard");
}
