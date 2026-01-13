"use client";

import { useEffect, useState } from "react";

import { DisclaimerModal } from "@/components/DisclaimerModal";
import { SignIn } from "@clerk/nextjs";

type Theme = "light" | "dark";

function setThemeCookie(theme: Theme) {
  // 1 year
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  document.cookie = `medichat_theme=${theme}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
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
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.22 4.22l1.42 1.42" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 18.36l1.42 1.42" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 12h2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.22 19.78l1.42-1.42" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 5.64l1.42-1.42" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  // Moon icon (switch to dark)
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
      />
    </svg>
  );
}

export default function AuthPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    
    // Check if disclaimer was already accepted
    const accepted = localStorage.getItem("medichat_disclaimer_accepted");
    if (accepted === "true") {
      setDisclaimerAccepted(true);
    } else {
      setShowDisclaimer(true);
    }
  }, []);

  const handleDisclaimerAccept = () => {
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    localStorage.setItem("medichat_disclaimer_accepted", "true");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-black transition-colors duration-200 relative">
      <DisclaimerModal 
        open={showDisclaimer} 
        onAccept={handleDisclaimerAccept} 
      />

      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={() => {
            const next: Theme = theme === "dark" ? "light" : "dark";
            setTheme(next);
            applyTheme(next);
          }}
          className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <span className="sr-only">Toggle theme</span>
          <ThemeIcon theme={theme} />
        </button>
      </div>
      <div className="w-full max-w-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 rounded-lg space-y-5 transition-colors duration-200">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Sign in or create an account to continue.</p>
        </div>

        <SignIn withSignUp={true}/>

        <div className="text-center space-y-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            By signing in, you accept our{" "}
            <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=bc5875fc-68c7-4979-a056-6290204cca3a" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-900 dark:hover:text-zinc-300">Terms of Service</a>
            {" "}and{" "}
            <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=95aefd01-158c-49ea-ad35-12a3b679fe79" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-900 dark:hover:text-zinc-300">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}