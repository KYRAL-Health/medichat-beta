import Link from "next/link";
import { and, desc, eq, gte, isNull } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/utils";
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
import { PatientNameEditor } from "@/components/PatientNameEditor";
import { MobileSplitLayout } from "@/components/MobileSplitLayout";

export default async function PatientDashboardPage() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).userId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Patient dashboard</h1>
        <p className="text-sm text-red-700 dark:text-red-200">
          Unable to load dashboard: {msg}
        </p>
      </div>
    );
  }

  // --- Fetch User Profile (Name) ---
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  // --- Chat Data Fetching ---
  const latestThread = await db.query.chatThreads.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.patientUserId, userId), eq(table.contextMode, "patient")),
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
      eq(userMemories.ownerUserId, userId),
      eq(userMemories.status, "proposed"),
      eq(userMemories.contextMode, "patient"),
      isNull(userMemories.subjectPatientUserId)
    ),
    orderBy: [desc(userMemories.createdAt)],
  });

  const pendingSuggestions = await db.query.patientRecordSuggestions.findMany({
    where: and(
      eq(patientRecordSuggestions.patientUserId, userId),
      eq(patientRecordSuggestions.status, "proposed")
    ),
    orderBy: [desc(patientRecordSuggestions.createdAt)],
  });

  // --- Dashboard Data Fetching ---
  const today = new Date().toISOString().slice(0, 10);
  const todaysDashboard = await db.query.patientDailyDashboards.findFirst({
    where: and(
      eq(patientDailyDashboards.patientUserId, userId),
      eq(patientDailyDashboards.date, today)
    ),
  });

  const latestVitals = await db.query.patientVitals.findFirst({
    where: eq(patientVitals.patientUserId, userId),
    orderBy: [desc(patientVitals.measuredAt)],
  });

  const recentDocs = await db.query.documents.findMany({
    where: eq(documents.patientUserId, userId),
    orderBy: [desc(documents.createdAt)],
    limit: 5,
  });

  const medsCount = await db.$count(
    patientMedications,
    and(
      eq(patientMedications.patientUserId, userId),
      eq(patientMedications.active, true)
    )
  );

  const conditionsCount = await db.$count(
    patientConditions,
    eq(patientConditions.patientUserId, userId)
  );

  // Simple logic for flagged labs
  const recentLabs = await db.query.patientLabResults.findMany({
    where: eq(patientLabResults.patientUserId, userId),
    orderBy: [desc(patientLabResults.collectedAt)],
    limit: 100,
  });
  const recentFlaggedLabsCount = recentLabs.filter((l) => Boolean(l.flag)).length;


  return (
    <MobileSplitLayout
      dashboard={
        <>
          <DailyDashboardCard
            patientUserId={userId}
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
            <h2 className="text-sm font-semibold">Quick Snapshot</h2>
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

          <Card className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
             <div className="flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold">Recent Docs</h2>
              <Link href="/patient/documents" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300">
                  View all
              </Link>
             </div>
             
             <div className="flex-1 overflow-y-auto min-h-[100px]">
                 {recentDocs.length > 0 ? (
                     <ul className="space-y-2">
                         {recentDocs.map(doc => (
                             <li key={doc.id} className="text-sm">
                                 <div className="font-medium truncate" title={doc.originalFileName}>
                                     {doc.originalFileName}
                                 </div>
                                 <div className="flex items-center justify-between text-xs text-zinc-500 mt-0.5">
                                     <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                     <span className={doc.status === 'parsed' ? 'text-green-600 dark:text-green-400' : ''}>
                                         {doc.status}
                                     </span>
                                 </div>
                                 {doc.status === 'parsed' && (
                                     <Link 
                                      href={`/patient/documents?insights=${doc.id}`}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline block mt-1"
                                     >
                                      View insights
                                     </Link>
                                 )}
                             </li>
                         ))}
                     </ul>
                 ) : (
                     <div className="h-full flex flex-col items-center justify-center text-center p-4">
                         <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-900 mb-2">
                             <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                             </svg>
                         </div>
                         <p className="text-sm text-zinc-500">No documents yet</p>
                     </div>
                 )}
             </div>

             <div className="pt-2 shrink-0">
                  <Link href="/patient/documents">
                      <Button variant="outline" size="sm" className="w-full">
                          Upload Document
                      </Button>
                  </Link>
             </div>
          </Card>
        </>
      }
    >
      <div className="mb-4 space-y-1 shrink-0">
        <PatientNameEditor 
          patientUserId={userId} 
          initialName={userProfile?.displayName ?? null} 
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your personal health assistant. Ask about symptoms, review records, or plan next steps.
        </p>
      </div>
      
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
         <ChatPanel
          mode="patient"
          patientUserId={userId}
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
