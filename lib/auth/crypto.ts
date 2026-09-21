import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SCRYPT_COST = 32768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const KEY_BYTES = 64;
const HASH_PATTERN = /^scrypt:32768:8:1:([a-f0-9]{32}):([a-f0-9]{128})$/;

export type AdminCredentials = {
  username: string;
  passwordHash: string;
  sessionSecret: string;
};

export function isPasswordHash(value: string): boolean {
  return HASH_PATTERN.test(value);
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELISM,
      maxmem: 64 * 1024 * 1024,
    }, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 1024) {
    throw new Error("密码至少需要 12 个字符，且不能超过 1024 字节。");
  }
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt:${SCRYPT_COST}:${SCRYPT_BLOCK_SIZE}:${SCRYPT_PARALLELISM}:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const match = HASH_PATTERN.exec(passwordHash);
  if (!match || !password || Buffer.byteLength(password, "utf8") > 1024) return false;
  const actual = await deriveKey(password, Buffer.from(match[1], "hex"));
  return timingSafeEqual(actual, Buffer.from(match[2], "hex"));
}

/** Hash both strings to compare fixed-length buffers, including different-length usernames. */
export function sameString(first: string, second: string): boolean {
  return timingSafeEqual(createHash("sha256").update(first).digest(), createHash("sha256").update(second).digest());
}

function credentialFingerprint(config: AdminCredentials): string {
  return createHmac("sha256", config.sessionSecret)
    .update(JSON.stringify([config.username, config.passwordHash]))
    .digest("base64url");
}

export function createSessionToken(config: AdminCredentials, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: config.username,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
    credentials: credentialFingerprint(config),
    nonce: randomBytes(16).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(
  token: string,
  config: AdminCredentials,
  now = Date.now(),
): { username: string } | null {
  if (token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
  const expected = createHmac("sha256", config.sessionSecret).update(parts[0]).digest("base64url");
  if (!sameString(parts[1], expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const time = Math.floor(now / 1000);
    if (!payload || typeof payload !== "object" || payload.v !== 1
      || typeof payload.sub !== "string" || !sameString(payload.sub, config.username)
      || typeof payload.credentials !== "string" || !sameString(payload.credentials, credentialFingerprint(config))
      || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)
      || payload.exp !== payload.iat + SESSION_TTL_SECONDS
      || payload.iat > time + 30 || payload.exp <= time
      || typeof payload.nonce !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(payload.nonce)) return null;
    return { username: config.username };
  } catch {
    return null;
  }
}
