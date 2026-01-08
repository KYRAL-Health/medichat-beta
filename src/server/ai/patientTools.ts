import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { patientRecordSuggestions } from "@/server/db/schema";

export const ProposeRecordSuggestionSchema = z.object({
  kind: z.enum(["profile_update", "vital", "lab", "medication", "condition"]),
  summaryText: z.string().min(1).max(500),
  payloadJson: z.record(z.unknown()), // Flexible payload based on kind
});

export async function proposePatientRecordSuggestion(args: {
  patientUserId: string;
  kind: "profile_update" | "vital" | "lab" | "medication" | "condition";
  summaryText: string;
  payloadJson: Record<string, unknown>;
  sourceThreadId: string;
  sourceMessageId?: string | null;
}) {
  const row = await db
    .insert(patientRecordSuggestions)
    .values({
      patientUserId: args.patientUserId,
      kind: args.kind,
      summaryText: args.summaryText,
      payloadJson: args.payloadJson,
      status: "proposed",
      sourceThreadId: args.sourceThreadId,
      sourceMessageId: args.sourceMessageId ?? null,
    })
    .returning()
    .then((rows) => rows[0]);

  if (!row) throw new Error("SUGGESTION_CREATE_FAILED");

  return {
    id: row.id,
    summaryText: row.summaryText,
    kind: row.kind,
    status: row.status,
  };
}

