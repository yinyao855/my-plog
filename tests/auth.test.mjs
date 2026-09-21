import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createSessionToken, hashPassword, isPasswordHash, SESSION_TTL_SECONDS, verifyPassword, verifySessionToken } from "../lib/auth/crypto.ts";
import { LoginRateLimiter } from "../lib/auth/rate-limit.ts";
import { assertSameOrigin, HttpError, readJsonBody } from "../lib/http.ts";

const config = { username: "photographer", passwordHash: `scrypt:32768:8:1:${"ab".repeat(16)}:${"cd".repeat(64)}`, sessionSecret: "only-for-tests-not-a-real-secret-123456789" };
const now = 1_800_000_000_000;

test("password hashing uses a unique salt and rejects wrong or malformed hashes", async () => {
  const password = "A-real-passphrase-光影-2026";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(isPasswordHash(first), true);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword(password, first.replace("32768", "2147483648")), false);
  assert.equal(await verifyPassword("a".repeat(1025), first), false);
  await assert.rejects(hashPassword("short"));
});

test("session expires exactly after eight hours and rejects tampering", () => {
  const token = createSessionToken(config, now);
  assert.deepEqual(verifySessionToken(token, config, now), { username: config.username });
  assert.ok(verifySessionToken(token, config, now + SESSION_TTL_SECONDS * 1000 - 1));
  assert.equal(verifySessionToken(token, config, now + SESSION_TTL_SECONDS * 1000), null);
  assert.equal(verifySessionToken(`x${token.slice(1)}`, config, now), null);
  assert.equal(verifySessionToken(`${token}.extra`, config, now), null);
  assert.equal(verifySessionToken(token.slice(0, -1), config, now), null);
  assert.equal(verifySessionToken(createSessionToken(config, now + 60_000), config, now), null);
});

test("password, username, and secret rotation invalidate issued sessions", () => {
  const token = createSessionToken(config, now);
  for (const replacement of [
    { username: "another-photographer" },
    { passwordHash: config.passwordHash.replace("ab", "ef") },
    { sessionSecret: `${config.sessionSecret}-rotated` },
  ]) assert.equal(verifySessionToken(token, { ...config, ...replacement }, now), null);
});

test("even correctly signed sessions require a valid claim shape and lifetime", () => {
  const [encoded] = createSessionToken(config, now).split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  for (const changes of [{ exp: payload.exp + 1 }, { iat: "yesterday" }, { nonce: null }, { v: 2 }]) {
    const invalid = Buffer.from(JSON.stringify({ ...payload, ...changes })).toString("base64url");
    const signed = `${invalid}.${createHmac("sha256", config.sessionSecret).update(invalid).digest("base64url")}`;
    assert.equal(verifySessionToken(signed, config, now), null);
  }
});

test("login limiter bounds username attempts and resets after the window", () => {
  const limiter = new LoginRateLimiter();
  for (let i = 0; i < 10; i++) assert.equal(limiter.consume("photographer", now), 0);
  assert.equal(limiter.consume("PHOTOGRAPHER", now), 900);
  assert.equal(limiter.consume("photographer", now + 900_000), 0);
});

test("global limiter cannot be bypassed by changing the username", () => {
  const limiter = new LoginRateLimiter();
  for (let i = 0; i < 60; i++) assert.equal(limiter.consume(`user-${i}`, now), 0);
  assert.equal(limiter.consume("new-user", now), 900);
});

test("mutation Origin must match the configured origin and cannot be missing", () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "https://photos.example.com";
  try {
    const request = (origin) => new Request("http://internal:3000/api/albums", { method: "POST", headers: origin ? { Origin: origin } : {} });
    assert.doesNotThrow(() => assertSameOrigin(request("https://photos.example.com")));
    for (const origin of [undefined, "null", "https://evil.example", "https://photos.example.com.evil.example"]) {
      assert.throws(() => assertSameOrigin(request(origin)), (error) => error instanceof HttpError && error.status === 403);
    }
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
});

test("JSON body parser rejects malformed and oversized requests without Content-Length", async () => {
  const request = (body) => new Request("http://localhost/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  assert.deepEqual(await readJsonBody(request('{"username":"yao"}')), { username: "yao" });
  await assert.rejects(readJsonBody(request("{not-json}")), (error) => error instanceof HttpError && error.status === 400);
  await assert.rejects(readJsonBody(request(JSON.stringify({ value: "a".repeat(32) })), 16), (error) => error instanceof HttpError && error.status === 413);
});
