import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/server/auth/utils";
import { ttsSpeak } from "@/server/ai/voice";

export const runtime = "nodejs";

const SpeakSchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SpeakSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const stream = await ttsSpeak(parsed.data.text, parsed.data.voice);

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[voice/speak]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "TTS failed" },
      { status: 500 }
    );
  }
}
