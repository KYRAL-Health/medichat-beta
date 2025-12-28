"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardRow = {
  id: string;
  patientUserId: string;
  date: string;
  model: string;
  dashboardJson: unknown;
  status: "generated" | "error";
  createdAt: string;
};

type DashboardJson = {
  overview?: string;
  insights?: string[];
  recommendations?: string[];
  redFlags?: string[];
  suggestedFollowUps?: string[];
};

export function DailyDashboardCard({
  patientUserId,
  initial,
}: {
  patientUserId?: string;
  initial?: DashboardRow | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardRow | null>(initial ?? null);

  const data: DashboardJson = useMemo(() => {
    const raw = dashboard?.dashboardJson;
    return (raw && typeof raw === "object" ? (raw as DashboardJson) : {}) as DashboardJson;
  }, [dashboard]);

  const generate = useCallback(async (force?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientUserId,
          force: Boolean(force),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        dashboard?: DashboardRow;
      };
      if (!res.ok) throw new Error(body.error || `Generate failed (${res.status})`);
      if (body.dashboard) setDashboard(body.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  }, [patientUserId]);

  // Auto-generate if missing for today.
  useEffect(() => {
    if (!dashboard && !loading) {
      void generate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">AI daily overview</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generates a short summary, insights, and suggestions based on the data available today.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate(Boolean(dashboard))}
          disabled={loading}
          className="px-3 py-2 text-sm rounded bg-zinc-900 text-white dark:bg-white dark:text-black disabled:opacity-50"
        >
          {loading ? "Generating…" : dashboard ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {dashboard ? (
        <div className="space-y-3">
          {data.overview ? <div className="text-sm whitespace-pre-wrap">{data.overview}</div> : null}

          {data.insights?.length ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Insights</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {data.insights.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.recommendations?.length ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Recommendations
              </div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {data.recommendations.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.redFlags?.length ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-red-700 dark:text-red-200">Red flags</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {data.redFlags.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.suggestedFollowUps?.length ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Follow-ups
              </div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {data.suggestedFollowUps.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            Model: {dashboard.model}
          </div>
        </div>
      ) : (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {loading ? "Generating today’s dashboard…" : "No dashboard generated yet for today."}
        </div>
      )}
    </section>
  );
}


