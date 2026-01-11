import Link from "next/link";
import { and, desc, eq, gte, isNull } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import {
  chatMessages,
  chatThreads,
  documents,
  patientConditions,
  patientDailyDashboards,
  patientLabResults,
  patientMedications,
  patientProfiles,
  patientRecordSuggestions,
  patientVitals,
  userMemories,
  userProfiles,
} from "@/server/db/schema";
import { DailyDashboardCard } from "@/components/DailyDashboardCard";
import { ChatPanel } from "@/components/ChatPanel";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PhysicianPatientDataPanel } from "@/components/PhysicianPatientDataPanel";
import { MobileSplitLayout } from "@/components/MobileSplitLayout";

export default async function PhysicianPatientDetailPage({
  params,
}: {
  params: { patientUserId: string } | Promise<{ patientUserId: string }>;
}) {
  const { patientUserId } = await params;

  let physicianUserId: string;
  try {
    const physician = await requireAuthenticatedUser();
    physicianUserId = physician.id;
  } catch (e) {
    return <div>Error loading user</div>;
  }

  try {
    await assertPatientAccess({ viewerUserId: physicianUserId, patientUserId });
  } catch (e) {
    return <div>Access denied</div>;
  }

  // --- Fetch Data ---
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, patientUserId),
  });

  const latestThread = await db.query.chatThreads.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.patientUserId, patientUserId), eq(table.contextMode, "physician")),
    orderBy: [desc(chatThreads.updatedAt)],
  });

  let initialMessages: Array<{ role: "user" | "assistant"; content: string }> =
    [];
  if (latestThread) {
    const msgs = await db.query.chatMessages.findMany({
      where: eq(chatMessages.threadId, latestThread.id),
      orderBy: [desc(chatMessages.createdAt)],
      limit: 50,
    });
    initialMessages = msgs
      .reverse()
      .filter((m) => m.senderRole === "user" || m.senderRole === "assistant")
      .map((m) => ({
        role: m.senderRole as "user" | "assistant",
        content: m.content,
      }));
  }

  const pendingMemories = await db.query.userMemories.findMany({
    where: and(
      eq(userMemories.ownerUserId, physicianUserId),
      eq(userMemories.status, "proposed"),
      eq(userMemories.contextMode, "physician"),
      eq(userMemories.subjectPatientUserId, patientUserId)
    ),
    orderBy: [desc(userMemories.createdAt)],
  });

  const pendingSuggestions = await db.query.patientRecordSuggestions.findMany({
    where: and(
      eq(patientRecordSuggestions.patientUserId, patientUserId),
      eq(patientRecordSuggestions.status, "proposed")
    ),
    orderBy: [desc(patientRecordSuggestions.createdAt)],
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysDashboard = await db.query.patientDailyDashboards.findFirst({
    where: and(
      eq(patientDailyDashboards.patientUserId, patientUserId),
      eq(patientDailyDashboards.date, today)
    ),
  });

  const latestVitals = await db.query.patientVitals.findFirst({
    where: eq(patientVitals.patientUserId, patientUserId),
    orderBy: [desc(patientVitals.measuredAt)],
  });

  const medsCount = await db.$count(
    patientMedications,
    and(
      eq(patientMedications.patientUserId, patientUserId),
      eq(patientMedications.active, true)
    )
  );

  const conditionsCount = await db.$count(
    patientConditions,
    eq(patientConditions.patientUserId, patientUserId)
  );

  const recentLabs = await db.query.patientLabResults.findMany({
    where: eq(patientLabResults.patientUserId, patientUserId),
    orderBy: [desc(patientLabResults.collectedAt)],
    limit: 100,
  });
  const recentFlaggedLabsCount = recentLabs.filter((l) => Boolean(l.flag)).length;

  return (
    <MobileSplitLayout
      dashboard={
        <>
          <DailyDashboardCard
            patientUserId={patientUserId}
            initial={
              todaysDashboard
                ? {
                    ...todaysDashboard,
                    createdAt: todaysDashboard.createdAt.toISOString(),
                  }
                : null
            }
          />

          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Patient Snapshot</h2>
            <div className="space-y-3 text-sm">
               <div>
                <div className="text-xs text-zinc-500">Latest Vitals</div>
                {latestVitals ? (
                  <div className="font-medium">
                    {latestVitals.systolic && latestVitals.diastolic
                      ? `BP ${latestVitals.systolic}/${latestVitals.diastolic}`
                      : "BP —"}
                    {" · "}
                    {latestVitals.heartRate ? `HR ${latestVitals.heartRate}` : "HR —"}
                  </div>
                ) : (
                   <div className="text-zinc-500 italic">No vitals recorded</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900">
                      <div className="text-xs text-zinc-500">Active Meds</div>
                      <div className="text-lg font-semibold">{medsCount}</div>
                  </div>
                  <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900">
                      <div className="text-xs text-zinc-500">Conditions</div>
                      <div className="text-lg font-semibold">{conditionsCount}</div>
                  </div>
              </div>

              {recentFlaggedLabsCount > 0 && (
                  <div className="p-2 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-100 dark:border-red-900/30">
                      <div className="text-xs font-medium">Recent Flagged Labs</div>
                      <div className="text-lg font-bold">{recentFlaggedLabsCount}</div>
                  </div>
              )}
            </div>
          </Card>

          {/* Patient Records Panel */}
          <div className="space-y-2">
              <h2 className="text-sm font-semibold px-1">Patient Records</h2>
              <PhysicianPatientDataPanel patientUserId={patientUserId} />
          </div>
        </>
      }
    >
      <div className="mb-4 space-y-1 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">
            {userProfile?.displayName || "Patient"}
          </h1>
          <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500 font-mono">
            {patientUserId.slice(0, 8)}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Clinical assistant mode. Ask for summaries, red flags, or draft plans.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        <ChatPanel
          mode="physician"
          patientUserId={patientUserId}
          initialThreadId={latestThread?.id}
          initialMessages={initialMessages}
          initialProposedMemories={pendingMemories.map((m) => ({
            id: m.id,
            memoryText: m.memoryText,
            category: m.category,
          }))}
          initialProposedSuggestions={pendingSuggestions.map((s) => ({
              id: s.id,
              kind: s.kind,
              summaryText: s.summaryText,
          }))}
        />
      </div>
    </MobileSplitLayout>
  );
}
