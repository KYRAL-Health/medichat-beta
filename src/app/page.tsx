import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
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
