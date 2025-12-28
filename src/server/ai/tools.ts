import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { userMemories } from "@/server/db/schema";

export async function retrieveMemories(args: {
  ownerUserId: string;
  limit?: number;
  contextMode?: "patient" | "physician";
  subjectPatientUserId?: string | null;
}) {
  const limit = args.limit ?? 20;
  const filters = [
    eq(userMemories.ownerUserId, args.ownerUserId),
    eq(userMemories.status, "accepted"),
  ];
  if (args.contextMode) {
    filters.push(eq(userMemories.contextMode, args.contextMode));
  }
  if (args.subjectPatientUserId === null) {
    filters.push(isNull(userMemories.subjectPatientUserId));
  } else if (typeof args.subjectPatientUserId === "string") {
    filters.push(eq(userMemories.subjectPatientUserId, args.subjectPatientUserId));
  }
  const rows = await db.query.userMemories.findMany({
    where: and(...filters),
    orderBy: [desc(userMemories.acceptedAt), desc(userMemories.createdAt)],
    limit,
  });

  return rows.map((m) => ({
    id: m.id,
    memoryText: m.memoryText,
    category: m.category,
    acceptedAt: m.acceptedAt,
  }));
}

export async function proposeMemory(args: {
  ownerUserId: string;
  contextMode: "patient" | "physician";
  subjectPatientUserId?: string | null;
  memoryText: string;
  category?: string | null;
  sourceThreadId?: string | null;
  sourceMessageId?: string | null;
}) {
  const row = await db
    .insert(userMemories)
    .values({
      ownerUserId: args.ownerUserId,
      contextMode: args.contextMode,
      subjectPatientUserId: args.subjectPatientUserId ?? null,
      status: "proposed",
      memoryText: args.memoryText,
      category: args.category ?? null,
      sourceThreadId: args.sourceThreadId ?? null,
      sourceMessageId: args.sourceMessageId ?? null,
    })
    .returning()
    .then((rows) => rows[0]);

  if (!row) throw new Error("MEMORY_CREATE_FAILED");

  return {
    id: row.id,
    memoryText: row.memoryText,
    category: row.category,
    status: row.status,
    createdAt: row.createdAt,
  };
}


