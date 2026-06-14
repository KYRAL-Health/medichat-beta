import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/server/auth/utils";
import { assertPatientAccess } from "@/server/authz/patientAccess";
import { createVoiceToken } from "@/server/ws/voiceProxy";

export const runtime = "nodejs";

const InitSchema = z.object({
  mode: z.enum(["patient", "physician"]),
  patientUserId: z.string().optional(),
  threadId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const parsed = InitSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { mode } = parsed.data;
    const patientUserId = mode === "patient" ? userId : parsed.data.patientUserId ?? null;

    if (!patientUserId) {
      return NextResponse.json({ error: "Missing patientUserId" }, { status: 400 });
    }

    if (mode === "physician") {
      await assertPatientAccess({ viewerUserId: userId, patientUserId });
    }

    const token = createVoiceToken(userId, mode, patientUserId);

    return NextResponse.json({ token });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN_PATIENT_ACCESS") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("/api/voice/live/init error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
