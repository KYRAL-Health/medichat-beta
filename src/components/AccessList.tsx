"use client";

import { useCallback, useEffect, useState } from "react";

import { LoadingDots } from "@/components/LoadingDots";

type PhysicianAccess = {
  physicianUserId: string;
  physicianClerkUserId: string;
  createdAt: string;
};

export function AccessList() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PhysicianAccess[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/access", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        physicians?: PhysicianAccess[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setRows(Array.isArray(body.physicians) ? body.physicians : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load access list");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(async (physicianUserId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/access/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ physicianUserId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Revoke failed (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setLoading(false);
    }
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Active physician access</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.length ? (
          rows.map((p) => (
            <div key={p.physicianUserId} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.physicianClerkUserId}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  Granted: {new Date(p.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void revoke(p.physicianUserId)}
                disabled={loading}
                className="px-3 py-2 text-sm rounded border border-red-500/30 text-red-700 dark:text-red-200 hover:bg-red-500/10 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span>Loading</span>
                <LoadingDots sizeClassName="h-1 w-1" />
              </span>
            ) : (
              "No physicians have access yet."
            )}
          </div>
        )}
      </div>
    </div>
  );
}


