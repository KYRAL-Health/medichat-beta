import crypto from "crypto";

export function createInviteToken() {
  // URL-safe token.
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}


