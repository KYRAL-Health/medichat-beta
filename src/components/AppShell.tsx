"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { reownAppKit } from "@/context/appkit";
import { DisclaimerModal } from "@/components/modals/DisclaimerModal";

type Mode = "patient" | "physician";
type Theme = "light" | "dark";

function setModeCookie(mode: Mode) {
  // 1 year
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  document.cookie = `medichat_mode=${mode}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearModeCookie() {
  document.cookie = "medichat_mode=; Path=/; Max-Age=0; SameSite=Lax";
}

function setThemeCookie(theme: Theme) {
  // 1 year
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  document.cookie = `medichat_theme=${theme}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function isDarkThemeActive() {
  return document.documentElement.classList.contains("dark");
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  setThemeCookie(theme);
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    // Sun icon (switch to light)
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.22 4.22l1.42 1.42"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.36 18.36l1.42 1.42"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 12h2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.22 19.78l1.42-1.42"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.36 5.64l1.42-1.42"
        />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  // Moon icon (switch to dark)
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
      />
    </svg>
  );
}

function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: ReactNode;
}) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (href !== "/patient/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
        active
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 font-medium"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-50",
      ].join(" ")}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({
  mode,
  disclaimerAccepted,
  children,
}: {
  mode: Mode;
  disclaimerAccepted: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("light");
  
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(disclaimerAccepted);
  
  // If the prop updates (due to server revalidation), sync the state
  useEffect(() => {
    if (disclaimerAccepted) {
      setHasAcceptedDisclaimer(true);
    }
  }, [disclaimerAccepted]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setTheme(isDarkThemeActive() ? "dark" : "light");
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      clearModeCookie();
      await reownAppKit.disconnect("solana").catch(() => {});
      window.location.assign("/auth");
    }
  };

  const handleModeChange = (nextMode: Mode) => {
    setModeCookie(nextMode);
    window.location.assign(
      nextMode === "physician" ? "/physician/patients" : "/patient/dashboard"
    );
  };

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const handleDisclaimerAccept = async () => {
    try {
      const res = await fetch("/api/auth/disclaimer/accept", {
        method: "POST",
      });
      if (res.ok) {
        setHasAcceptedDisclaimer(true);
        router.refresh(); // Sync server state
      } else {
        console.error("Failed to accept disclaimer");
      }
    } catch (e) {
      console.error(e);
    }
  };

   // Patient Navigation Items
  const patientLinks = [
    {
      href: "/patient/dashboard",
      label: "AI Home",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
    },
    {
      href: "/patient/documents",
      label: "Documents",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      href: "/patient/data",
      label: "My Data",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    // {
    //     href: "/patient/map",
    //     label: "Health Map",
    //     icon: (
    //         <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    //             <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    //         </svg>
    //     )
    // },
    {
      href: "/patient/sharing",
      label: "Sharing",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      ),
    },
  ];

  // Physician Navigation Items
  const physicianLinks = [
    {
      href: "/physician/patients",
      label: "Patients",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      href: "/physician/invites",
      label: "Invites",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    // {
    //     href: "/physician/map",
    //     label: "Health Map",
    //     icon: (...)
    // },
  ];

  const currentLinks = mode === "physician" ? physicianLinks : patientLinks;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 transition-colors duration-200 flex">
      <DisclaimerModal 
        open={!hasAcceptedDisclaimer} 
        onAccept={handleDisclaimerAccept} 
      />

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 fixed inset-y-0 z-20">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center h-14 shrink-0 gap-2">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            MediChat
          </Link>
          <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
            {mode}
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {currentLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 justify-between">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
              title="Toggle Theme"
            >
              <ThemeIcon theme={theme} />
            </button>

            <button
              onClick={() =>
                handleModeChange(mode === "patient" ? "physician" : "patient")
              }
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 px-2"
              title={`Switch to ${
                mode === "patient" ? "Physician" : "Patient"
              } View`}
            >
              {mode === "patient" ? "Physician" : "Patient"}
            </button>

            <button
              onClick={handleLogout}
              className="text-xs text-red-600 dark:text-red-400 hover:underline px-2"
            >
              Log out
            </button>
          </div>

          <div className="space-y-2 text-center">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-600">
              <span className="font-semibold text-red-500">
                Call 911 for emergencies.
              </span>
              <br />
              MediChat is an AI assistant, not a doctor.
            </div>
            <div className="flex justify-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-600">
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
              <span>·</span>
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-semibold">
              MediChat
            </Link>
            <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 uppercase">
              {mode}
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <span className="sr-only">Open menu</span>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              stroke="currentColor"
              fill="none"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-white dark:bg-zinc-950 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <span className="font-semibold">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {currentLinks.map((link) => (
                <div key={link.href} onClick={() => setMobileMenuOpen(false)}>
                  <NavLink {...link} />
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-medium">Theme</span>
                <button onClick={toggleTheme} className="p-2 border rounded-md">
                  <ThemeIcon theme={theme} />
                </button>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-medium">Switch Mode</span>
                <button
                  onClick={() =>
                    handleModeChange(
                      mode === "patient" ? "physician" : "patient"
                    )
                  }
                  className="px-3 py-1.5 text-xs border rounded-md"
                >
                  To {mode === "patient" ? "Physician" : "Patient"}
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md"
              >
                Log out
              </button>

              <div className="space-y-2 text-center pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <div className="text-[10px] text-zinc-400 dark:text-zinc-600">
                  <span className="font-semibold text-red-500">
                    Call 911 for emergencies.
                  </span>
                  <br />
                  Not medical advice.
                </div>
                <div className="flex justify-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-600">
                  <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=bc5875fc-68c7-4979-a056-6290204cca3a" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Terms
                  </a>
                  <span>·</span>
                  <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=95aefd01-158c-49ea-ad35-12a3b679fe79" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Privacy
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
