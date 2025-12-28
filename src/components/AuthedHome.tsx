"use client";

import { useRouter } from "next/navigation";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import { reownAppKit } from "@/context/appkit";
import { useWalletAuth } from "@/hooks/useWalletAuth";

export function AuthedHome() {
  const router = useRouter();
  const walletAuth = useWalletAuth();
  const { open } = useAppKit();
  const account = useAppKitAccount();

  const embeddedUser = account.embeddedWalletInfo?.user;
  const embeddedAuthProvider = account.embeddedWalletInfo?.authProvider;

  const handleDisconnect = async () => {
    // Clear app session + disconnect the underlying Reown connection.
    await walletAuth.logout();
    await reownAppKit.disconnect("solana").catch(() => {});
    router.replace("/auth");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">You are logged in now</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This session is stored via a JWT cookie, and your account is managed by
            Reown.
          </p>
        </header>

        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Reown account</h2>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={() => open({ view: "Account" })}
              >
                Open account
              </button>
              <button
                className="px-3 py-1.5 text-xs rounded border border-red-500/30 text-red-700 dark:text-red-200 hover:bg-red-500/10"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Address</dt>
              <dd className="font-mono text-xs break-all text-right">
                {account.address ?? "—"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="text-right">{embeddedUser?.email ?? "—"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Username</dt>
              <dd className="text-right">{embeddedUser?.username ?? "—"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Auth provider</dt>
              <dd className="text-right">{embeddedAuthProvider ?? "—"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Session user</dt>
              <dd className="text-right font-mono text-xs break-all">
                {walletAuth.user?.id ?? "—"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

