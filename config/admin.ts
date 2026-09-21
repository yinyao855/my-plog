import "server-only";

import { isPasswordHash, type AdminCredentials } from "@/lib/auth/crypto";

/** Credentials live in .env.local or deployment secrets, never in the client bundle. */
export function getAdminConfig(): AdminCredentials | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!username || username.length > 80 || !passwordHash || !isPasswordHash(passwordHash)
    || !sessionSecret || Buffer.byteLength(sessionSecret, "utf8") < 32) return null;
  return { username, passwordHash, sessionSecret };
}
