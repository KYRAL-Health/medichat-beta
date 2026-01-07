import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

const SESSION_COOKIE_NAME = "vibe_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type SessionPayload = {
  sub: string;
  walletAddress: string;
  exp: number;
};

export interface AuthenticatedUser {
  id: string;
  walletAddress: string;
  disclaimerAcceptedAt?: Date | null;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function createSessionToken(walletAddress: string) {
  // Use wallet address as the subject - we'll create DB user lazily when needed
  return jwt.sign({ sub: walletAddress, walletAddress }, getJwtSecret(), {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

/**
 * Get or create a user in the database based on wallet address.
 * This is called lazily when we actually need a DB user (e.g., to read/write medical data).
 * Returns null if DB is not available/configured (e.g., RLS issues).
 */
export async function getOrCreateUser(
  walletAddress: string
): Promise<AuthenticatedUser | null> {
  try {
    // Use an upsert to avoid race conditions (multiple concurrent requests during first login).
    // This keeps the auth experience clean even when layout+page render in parallel.
    const row = await db
      .insert(users)
      .values({ walletAddress })
      .onConflictDoUpdate({
        target: users.walletAddress,
        set: { updatedAt: new Date() },
      })
      .returning()
      .then((rows) => rows[0]);

    if (row) {
      return { 
        id: row.id, 
        walletAddress: row.walletAddress,
        disclaimerAcceptedAt: row.disclaimerAcceptedAt
      };
    }

    // Extremely defensive fallback.
    const existingUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, walletAddress),
    });
    return existingUser
      ? { 
          id: existingUser.id, 
          walletAddress: existingUser.walletAddress,
          disclaimerAcceptedAt: existingUser.disclaimerAcceptedAt 
        }
      : null;
  } catch (error) {
    // If DB operations fail (e.g., RLS issues, not configured), return null
    // This allows the app to work without DB, but DB features won't work
    console.error("Database operation failed (user may not be configured):", error);
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    path: "/",
  });
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    typeof payload.walletAddress === "string" &&
    typeof payload.exp === "number"
  );
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!isSessionPayload(decoded)) return null;

    // Return wallet-based auth info without DB lookup
    // DB user will be created lazily when needed
    return {
      id: decoded.sub, // This is the wallet address for now
      walletAddress: decoded.walletAddress,
    };
  } catch {
    return null;
  }
}

/**
 * Get authenticated user with DB record. Creates user lazily if needed.
 * Use this when you need the actual DB user ID (e.g., for foreign keys).
 */
export async function getAuthenticatedUserWithDb(): Promise<AuthenticatedUser | null> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return null;

  // If sub is a UUID, we already have a DB user
  // Otherwise, it's a wallet address and we need to get/create the DB user
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    authUser.id
  );

  if (isUuid) {
    // Already a DB user ID, verify it exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
    });
    return user ? { id: user.id, walletAddress: user.walletAddress } : null;
  }

  // Wallet address - get or create DB user
  return getOrCreateUser(authUser.walletAddress);
}

export async function requireAuthenticatedUser() {
  // Use the DB version since most operations need a real user ID
  const user = await getAuthenticatedUserWithDb();
  if (!user) {
    // Check if it's an auth issue or DB issue
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      throw new Error("UNAUTHENTICATED");
    }
    // User is authenticated but DB is not available
    throw new Error("DATABASE_NOT_AVAILABLE");
  }
  return user;
}

