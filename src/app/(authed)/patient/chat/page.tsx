import { desc, eq } from "drizzle-orm";

import { ChatPanel } from "@/components/ChatPanel";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { chatMessages, chatThreads, userMemories } from "@/server/db/schema";

export default async function PatientChatPage() {
  const user = await requireAuthenticatedUser();

  // Find the latest active thread for this patient in patient mode
  const latestThread = await db.query.chatThreads.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.patientUserId, user.id), eq(table.contextMode, "patient")),
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

  // Fetch pending memories (proposed but not acted on)
  const pendingMemories = await db.query.userMemories.findMany({
    where: (table, { and, eq, isNull }) =>
      and(
        eq(table.ownerUserId, user.id),
        eq(table.status, "proposed"),
        eq(table.contextMode, "patient"),
        isNull(table.subjectPatientUserId)
      ),
    orderBy: [desc(userMemories.createdAt)],
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Chat</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Chat with an AI assistant grounded in your data and documents. The
          assistant can propose “memories” (personalization) that you confirm.
        </p>
      </div>

      <ChatPanel
        mode="patient"
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
