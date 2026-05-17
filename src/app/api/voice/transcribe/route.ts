import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/server/auth/utils";
import { sttTranscribe } from "@/server/ai/voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const audioFile = form.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: "Missing audio field" }, { status: 400 });
    }

    // Reject files over 10 MB to prevent memory exhaustion
    const MAX_BYTES = 10 * 1024 * 1024;
    if (audioFile.size > MAX_BYTES) {
      return NextResponse.json({ error: "Audio file too large (max 10 MB)" }, { status: 413 });
    }

    const mimeType = audioFile.type || "audio/webm";
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await sttTranscribe(buffer, mimeType);
    return NextResponse.json({ text });
  } catch (e) {
    console.error("[voice/transcribe]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
