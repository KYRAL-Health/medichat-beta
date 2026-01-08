import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

const SESSION_COOKIE_NAME = "vibe_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type SessionPayload = {
  sub: string;
  walletAddress: string;
  email?: string | null;
  exp: number;
};

export interface AuthenticatedUser {
  id: string;
  walletAddress: string;
  email?: string | null;
  disclaimerAcceptedAt?: Date | null;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function createSessionToken(walletAddress: string, userId: string, emailAddress?: string | null): string {
  // Use the database user ID as the subject
  return jwt.sign({ sub: userId, walletAddress, email: emailAddress }, getJwtSecret(), {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

/**
 * Ensure a user exists in the database.
 * This MUST be called during the auth flow to guarantee the user record exists.
 * Throws an error if the DB operation fails.
 */
export async function ensureUserRecord(
  walletAddress: string,
  email?: string | null
): Promise<AuthenticatedUser> {
  try {
    // Use an upsert to avoid race conditions (multiple concurrent requests during first login).
    // Only update `updatedAt` (and `email`) if the provided email actually differs from the
    // existing value. If no email was provided, do nothing on conflict so we don't touch timestamps.
    let row;
    const providedEmail = typeof email !== "undefined" && email !== null;

    if (providedEmail) {
      // Update only when the excluded email is distinct from the stored one.
      row = await db
        .insert(users)
        .values({ walletAddress, email })
        .onConflictDoUpdate({
          target: users.walletAddress,
          set: { email: sql`excluded.email`, updatedAt: new Date() },
          setWhere: sql`excluded.email IS DISTINCT FROM ${users.email}`,
        })
        .returning()
        .then((rows) => rows[0]);
    } else {
      // No email provided — avoid touching `updatedAt` on conflict.
      row = await db
        .insert(users)
        .values({ walletAddress, email })
        .onConflictDoNothing()
        .returning()
        .then((rows) => rows[0]);
    }

    if (row) {
      return {
        id: row.id,
        walletAddress: row.walletAddress,
        email: row.email,
        disclaimerAcceptedAt: row.disclaimerAcceptedAt,
      };
    }

    // Extremely defensive fallback - should not happen with upsert returning
    const existingUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, walletAddress),
    });
    
    if (!existingUser) {
        throw new Error("Failed to create or retrieve user");
    }

    return {
        id: existingUser.id,
        walletAddress: existingUser.walletAddress,
        email: existingUser.email,
        disclaimerAcceptedAt: existingUser.disclaimerAcceptedAt,
    };
  } catch (error) {
    console.error("Database operation failed in ensureUserRecord:", error);
    throw error;
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
    typeof payload.exp === "number" &&
    (typeof payload.email === "undefined" || typeof payload.email === "string" || payload.email === null)
  );
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!isSessionPayload(decoded)) return null;

    // Return auth info from token
    return {
      id: decoded.sub, // This is expected to be the user ID (UUID)
      walletAddress: decoded.walletAddress,
      email: decoded.email ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Get authenticated user with DB record.
 * Expects the user to exist in the database.
 * No longer creates users lazily.
 */
export async function getAuthenticatedUserWithDb(): Promise<AuthenticatedUser | null> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return null;

  // Ideally authUser.id is the UUID from the token (sub)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    authUser.id
  );

  if (isUuid) {
    // Standard path: verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
    });
    return user
      ? {
          id: user.id,
          walletAddress: user.walletAddress,
          email: user.email,
          disclaimerAcceptedAt: user.disclaimerAcceptedAt,
        }
      : null;
  }

  // Legacy fallback: Token has wallet address as sub
  // Try to find user by wallet address (Read-only)
  const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, authUser.walletAddress),
  });

  return user ? {
       id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        disclaimerAcceptedAt: user.disclaimerAcceptedAt,
  } : null;
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

