import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getAuthenticatedUser } from "@/server/auth/session";

export default async function Home() {
  try {
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
  } catch (error) {
    // If there's an error (e.g., missing JWT_SECRET), redirect to auth
    // This prevents the page from crashing and showing 404
    console.error("Error in home page:", error);
    redirect("/auth");
  }
}
