import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCachedJson } from '@/lib/fetchCached';
import { getClientIp } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';

const Query = z.object({
  term: z.string().min(1).max(80),
  limit: z.string().optional()
});

export async function GET(req: Request) {
  const ip = getClientIp();
  const rl = rateLimit(`cn:${ip}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({ term: url.searchParams.get('term'), limit: url.searchParams.get('limit') });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid term' }, { status: 400 });

  const term = parsed.data.term.trim();
  const limit = Math.min(50, Math.max(5, Number(parsed.data.limit || 25)));

  const upstream = `https://api.conceptnet.io/c/en/${encodeURIComponent(term)}?limit=${limit}`;
  const data = await fetchCachedJson(upstream, { ttlMs: 1000 * 60 * 60 * 24 * 3, cacheKey: `cn:${term}:${limit}` });
  return NextResponse.json({ term, data, remaining: rl.remaining });
}
