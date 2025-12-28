"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type InviteKind = "patientInvitesPhysician" | "physicianInvitesPatient";

type Invite = {
  id: string;
  kind: InviteKind;
  status: "active" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export function InviteLinks({
  kind,
  title,
  description,
}: {
  kind: InviteKind;
  title: string;
  description: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const filtered = useMemo(() => invites.filter((i) => i.kind === kind), [invites, kind]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { invites?: Invite[]; error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Failed (${res.status})`);
      }
      setInvites(Array.isArray(body.invites) ? body.invites : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invites");
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCreatedUrl(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = (await res.json().catch(() => ({}))) as { inviteUrl?: string; error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Create failed (${res.status})`);
      }
      if (body.inviteUrl) {
        setCreatedUrl(body.inviteUrl);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }, [kind, refresh]);

  const revoke = useCallback(
    async (inviteId: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/invites/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteId }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(body.error || `Revoke failed (${res.status})`);
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Revoke failed");
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void create()}
          disabled={loading}
          className="px-4 py-2 rounded bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Working…" : "Create invite link"}
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="px-4 py-2 rounded border border-zinc-200 dark:border-zinc-800 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {createdUrl ? (
        <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black px-3 py-2 text-sm flex items-center justify-between gap-3">
          <div className="font-mono text-xs break-all">{createdUrl}</div>
          <button
            type="button"
            onClick={() => void copy(createdUrl)}
            className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900"
          >
            Copy
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
        {filtered.length ? (
          filtered.map((i) => (
            <div key={i.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-medium">Status:</span> {i.status}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  Expires: {new Date(i.expiresAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {i.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => void revoke(i.id)}
                    disabled={loading}
                    className="px-3 py-2 text-sm rounded border border-red-500/30 text-red-700 dark:text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">No invites yet.</div>
        )}
      </div>
    </div>
  );
}


