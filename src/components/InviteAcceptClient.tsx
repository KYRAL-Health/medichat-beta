"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AcceptResult = {
  ok: boolean;
  kind?: "patientInvitesPhysician" | "physicianInvitesPatient";
  patientUserId?: string;
  physicianUserId?: string;
  error?: string;
};

export function InviteAcceptClient({
  token,
  disabled,
}: {
  token: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AcceptResult | null>(null);

  const accept = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json().catch(() => ({}))) as AcceptResult;
      if (!res.ok) {
        setResult({ ok: false, error: body.error || `Failed (${res.status})` });
        return;
      }
      const { ok: _, ...rest } = body;
      setResult({ ok: true, ...rest });

      if (body.kind === "patientInvitesPhysician") {
        document.cookie = `medichat_mode=physician; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        // Hard navigation so the authed layout re-reads the cookie reliably.
        window.location.assign("/physician/patients");
      } else if (body.kind === "physicianInvitesPatient") {
        document.cookie = `medichat_mode=patient; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        // Hard navigation so the authed layout re-reads the cookie reliably.
        window.location.assign("/patient/dashboard");
      } else {
        window.location.assign("/");
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void accept()}
          disabled={disabled || loading}
          className="px-4 py-2 rounded bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Accepting…" : "Accept invite"}
        </button>
      </div>

      {disabled ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This invite can’t be accepted (it may be expired, revoked, or already accepted).
        </p>
      ) : null}

      {result?.error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {result.error}
        </div>
      ) : null}
    </section>
  );
}


