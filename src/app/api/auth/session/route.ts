import { NextRequest, NextResponse } from "next/server";

import {
  getAuthenticatedUser,
  createSessionToken,
  setSessionCookie,
} from "@/server/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({ authenticated: true, user });
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, email } = (await req.json()) as {
      walletAddress?: string;
      email?: string | null;
    };

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    // Ensure user exists (strict/eager creation)
    let dbUser;
    try {
      const { ensureUserRecord } = await import("@/server/auth/session");
      dbUser = await ensureUserRecord(walletAddress, email);
    } catch (e) {
      console.error("Failed to ensure user record:", e);
      return NextResponse.json({ error: "Database error - failed to create user" }, { status: 500 });
    }

    // Create session token with DB user ID
    const token = createSessionToken(walletAddress, dbUser.id, email);

    const response = NextResponse.json({
      ok: true,
      user: dbUser,
    });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("/api/auth/session POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

