import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { auth } from "@clerk/nextjs/server";

export default async function AuthedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    redirect("/auth/sign-in");
  }
  
  const cookieStore = await cookies();
  const modeCookie = cookieStore.get("medichat_mode")?.value;
  const mode = modeCookie === "physician" ? "physician" : "patient";

  return (
    <AppShell 
      mode={mode} 
    >
      {children}
    </AppShell>
  );
}


