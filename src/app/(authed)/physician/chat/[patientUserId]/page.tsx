import { desc, eq } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { chatMessages, chatThreads, userMemories } from "@/server/db/schema";
import { ChatPanel } from "@/components/ChatPanel";

export default async function PhysicianChatPage({
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
    const msg = e instanceof Error ? e.message : "Unknown error";
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Physician chat</h1>
        <p className="text-sm text-red-700 dark:text-red-200">
          Unable to load: {msg}
        </p>
      </div>
    );
  }

  try {
    await assertPatientAccess({ viewerUserId: physicianUserId, patientUserId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Physician chat</h1>
        <p className="text-sm text-red-700 dark:text-red-200">
          Access denied: {msg}
        </p>
      </div>
    );
  }

  // Find latest thread for this patient created by this physician
  const latestThread = await db.query.chatThreads.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.patientUserId, patientUserId),
        eq(table.createdByUserId, physicianUserId),
        eq(table.contextMode, "physician")
      ),
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

  // Physician view also sees pending memories for themselves (if they own them).
  // Note: physician-mode memories are scoped to the patient being discussed.
  const pendingMemories = await db.query.userMemories.findMany({
    where: (table, { and, eq }) =>
      and(
        eq(table.ownerUserId, physicianUserId),
        eq(table.status, "proposed"),
        eq(table.contextMode, "physician"),
        eq(table.subjectPatientUserId, patientUserId)
      ),
    orderBy: [desc(userMemories.createdAt)],
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Physician chat</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Patient ID: <span className="font-mono text-xs">{patientUserId}</span>
        </p>
      </div>

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
      />
    </div>
  );
}
