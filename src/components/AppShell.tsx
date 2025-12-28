"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { reownAppKit } from "@/context/appkit";

type Mode = "patient" | "physician";

function setModeCookie(mode: Mode) {
  // 1 year
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  document.cookie = `medichat_mode=${mode}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearModeCookie() {
  document.cookie = "medichat_mode=; Path=/; Max-Age=0; SameSite=Lax";
}

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={[
        "text-sm px-3 py-2 rounded",
        active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function AppShell({
  mode,
  children,
}: {
  mode: Mode;
  children: ReactNode;
}) {
  const router = useRouter();

  const links = useMemo(() => {
    if (mode === "physician") {
      return [
        { href: "/physician/patients", label: "Patients" },
        { href: "/physician/invites", label: "Invites" },
      ];
    }
    return [
      { href: "/patient/dashboard", label: "Dashboard" },
      { href: "/patient/map", label: "Health Map" },
      { href: "/patient/data", label: "My Data" },
      { href: "/patient/documents", label: "Documents" },
      { href: "/patient/sharing", label: "Sharing" },
      { href: "/patient/chat", label: "Chat" },
    ];
  }, [mode]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      clearModeCookie();
      await reownAppKit.disconnect("solana").catch(() => {});
      // Hard navigation to ensure the authed layout is fully torn down.
      window.location.assign("/auth");
    }
  };

  const handleModeChange = (nextMode: Mode) => {
    setModeCookie(nextMode);
    // Hard navigation so the server layout re-reads the cookie reliably.
    window.location.assign(
      nextMode === "physician" ? "/physician/patients" : "/patient/dashboard"
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold">
              MediChat
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {links.map((l) => (
                <NavLink key={l.href} href={l.href} label={l.label} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <button
                type="button"
                onClick={() => handleModeChange("patient")}
                className={[
                  "px-3 py-1.5 text-xs",
                  mode === "patient"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                ].join(" ")}
              >
                Patient
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("physician")}
                className={[
                  "px-3 py-1.5 text-xs",
                  mode === "physician"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                ].join(" ")}
              >
                Physician
              </button>
            </div>

            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-red-500/30 text-red-700 dark:text-red-200 hover:bg-red-500/10"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 text-xs text-zinc-500 dark:text-zinc-500">
        Not medical advice. If this is an emergency, call your local emergency services.
      </footer>
    </div>
  );
}


