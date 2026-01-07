import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAuthenticatedUser, requireAuthenticatedUser } from "@/server/auth/session";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.update(users)
      .set({ disclaimerAcceptedAt: new Date() })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error accepting disclaimer:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
