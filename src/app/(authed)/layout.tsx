import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { getAuthenticatedUserWithDb } from "@/server/auth/session";

export default async function AuthedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUserWithDb();
  if (!user) {
    redirect("/auth");
  }

  const cookieStore = await cookies();
  const modeCookie = cookieStore.get("medichat_mode")?.value;
  const mode = modeCookie === "physician" ? "physician" : "patient";

  return (
    <AppShell 
      mode={mode} 
      disclaimerAccepted={!!user.disclaimerAcceptedAt}
    >
      {children}
    </AppShell>
  );
}


