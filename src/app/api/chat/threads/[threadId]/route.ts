import { NextRequest, NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { chatMessages, chatThreads } from "@/server/db/schema";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } | Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const { userId } = await requireAuthenticatedUser();

    const thread = await db.query.chatThreads.findFirst({
        where: eq(chatThreads.id, threadId)
    });

    if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Access control:
    // If physician mode, check patient access.
    // If patient mode, only they can see their threads (or authorized physician).
    // Basically, if the user isn't the patient, check access.
    if (thread.patientUserId !== userId) {
         await assertPatientAccess({ viewerUserId: userId, patientUserId: thread.patientUserId });
    }

    const msgs = await db.query.chatMessages.findMany({
      where: eq(chatMessages.threadId, threadId),
      orderBy: [desc(chatMessages.createdAt)],
      limit: 100,
    });

    const messages = msgs
      .reverse()
      .filter((m) => m.senderRole === "user" || m.senderRole === "assistant")
      .map((m) => ({
        role: m.senderRole as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt,
      }));

    return NextResponse.json({ thread, messages });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (
        error instanceof Error &&
        error.message === "FORBIDDEN_PATIENT_ACCESS"
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    console.error("/api/chat/threads/[threadId] GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { threadId: string } | Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const { userId } = await requireAuthenticatedUser();

    const thread = await db.query.chatThreads.findFirst({
        where: eq(chatThreads.id, threadId)
    });

    if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Authorization:
    // User must be the creator of the thread OR the patient whose data it is.
    const isCreator = thread.createdByUserId === userId;
    const isPatient = thread.patientUserId === userId;

    if (!isCreator && !isPatient) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(chatThreads).where(eq(chatThreads.id, threadId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("/api/chat/threads/[threadId] DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
