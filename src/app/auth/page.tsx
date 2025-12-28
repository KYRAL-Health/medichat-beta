"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import { useWalletAuth } from "@/hooks/useWalletAuth";

function getSafeReturnTo(value: string | null) {
  if (!value) return null;
  // Only allow internal paths.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const walletAuth = useWalletAuth();
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();

  useEffect(() => {
    if (walletAuth.status === "authenticated") {
      const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
      router.replace(returnTo ?? "/");
    }
  }, [walletAuth.status, router, searchParams]);

  const isLoading =
    walletAuth.status === "checking" || walletAuth.status === "authenticating";

  const handleSignIn = () => {
    if (!isConnected) {
      open();
    } else if (walletAuth.status === "unauthenticated") {
      walletAuth.authenticate();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 rounded-lg space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Use Reown email login to continue.
          </p>
        </div>

        {walletAuth.error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
            {walletAuth.error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          className="w-full px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? "Signing in…" : "Sign in with email"}
        </button>

        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Connect with Reown to create a session. Email login is supported.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 rounded-lg">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}

