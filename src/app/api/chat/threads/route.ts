import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { db } from "@/server/db";
import { chatThreads } from "@/server/db/schema";

export const runtime = "nodejs";

const CreateThreadSchema = z.object({
  patientUserId: z.string().uuid().optional(),
  title: z.string().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const url = new URL(req.url);
    const patientUserId = url.searchParams.get("patientUserId") ?? userId;
    const mode = (url.searchParams.get("mode") as "patient" | "physician") ?? "patient";

    if (mode === "physician" || patientUserId !== userId) {
        await assertPatientAccess({ viewerUserId: userId, patientUserId });
    }

    const threads = await db.query.chatThreads.findMany({
      where: and(
        eq(chatThreads.patientUserId, patientUserId),
        eq(chatThreads.contextMode, mode)
      ),
      orderBy: [desc(chatThreads.updatedAt)],
      limit: 50,
    });

    return NextResponse.json({ threads });
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
    console.error("/api/chat/threads GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const parsed = CreateThreadSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const mode = (new URL(req.url).searchParams.get("mode") as "patient" | "physician") ?? "patient";
    const patientUserId = mode === 'patient' ? userId : (parsed.data.patientUserId ?? null);

    if (!patientUserId) {
        return NextResponse.json({ error: "Missing patientUserId" }, { status: 400 });
    }

    if (mode === "physician" || patientUserId !== userId) {
        await assertPatientAccess({ viewerUserId: userId, patientUserId });
    }

    const thread = await db
      .insert(chatThreads)
      .values({
        patientUserId,
        createdByUserId: userId,
        contextMode: mode,
        title: parsed.data.title ?? "New Chat",
        updatedAt: new Date(),
      })
      .returning()
      .then((rows) => rows[0]);

    return NextResponse.json({ ok: true, thread });
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
    console.error("/api/chat/threads POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

