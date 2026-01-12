import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAuthenticatedUser } from "@/server/auth/utils";

export async function POST() {
  try {
    const { userId, sessionClaims } = await requireAuthenticatedUser();
    const client = await clerkClient();

    if (sessionClaims.disclaimerAcceptedAt) {
      return NextResponse.json({ message: "Disclaimer already accepted." }, { status: 400 });
    }

    // Update the user's public metadata so the acceptance is attached to the user
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        disclaimerAcceptedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error accepting disclaimer:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
