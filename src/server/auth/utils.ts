import { auth } from "@clerk/nextjs/server";

export async function requireAuthenticatedUser() {
    const { isAuthenticated, userId, sessionClaims } = await auth();
    if (!isAuthenticated || !userId) throw new Error("UNAUTHENTICATED");
    return { userId, sessionClaims };
}