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
    const { walletAddress } = (await req.json()) as {
      walletAddress?: string;
    };

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    // Create session token without DB lookup - user will be created lazily when needed
    // This avoids RLS issues and makes auth work even if DB has problems
    const token = createSessionToken(walletAddress);
    const response = NextResponse.json({
      ok: true,
      user: { id: walletAddress, walletAddress }, // Temporary ID until DB user is created
    });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("/api/auth/session POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

