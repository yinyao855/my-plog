const WINDOW_MS = 15 * 60 * 1000;
const MAX_USER_ATTEMPTS = 10;
const MAX_GLOBAL_ATTEMPTS = 60;
const MAX_BUCKETS = 256;

type Bucket = { attempts: number; expiresAt: number };

/** Process-local defense; multi-instance deployments need a shared limiter at the proxy. */
export class LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private global: Bucket = { attempts: 0, expiresAt: 0 };

  consume(username: string, now = Date.now()): number {
    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAt <= now) this.buckets.delete(key);
    }
    if (this.global.expiresAt <= now) this.global = { attempts: 0, expiresAt: now + WINDOW_MS };
    if (this.global.attempts >= MAX_GLOBAL_ATTEMPTS) return Math.ceil((this.global.expiresAt - now) / 1000);
    const key = username.trim().toLowerCase();
    const existing = this.buckets.get(key);
    if (existing && existing.attempts >= MAX_USER_ATTEMPTS) return Math.ceil((existing.expiresAt - now) / 1000);
    if (!existing && this.buckets.size >= MAX_BUCKETS) return Math.ceil(WINDOW_MS / 1000);
    this.global.attempts += 1;
    this.buckets.set(key, {
      attempts: (existing?.attempts ?? 0) + 1,
      expiresAt: existing?.expiresAt ?? now + WINDOW_MS,
    });
    return 0;
  }
}

const authGlobal = globalThis as typeof globalThis & { lumenLoginLimiter?: LoginRateLimiter };
export const loginRateLimiter = authGlobal.lumenLoginLimiter ??= new LoginRateLimiter();
