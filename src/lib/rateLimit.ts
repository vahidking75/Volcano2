type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { windowMs: number; max: number }) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, resetAt: now + opts.windowMs };
  }
  if (b.count >= opts.max) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  buckets.set(key, b);
  return { ok: true, remaining: opts.max - b.count, resetAt: b.resetAt };
}
