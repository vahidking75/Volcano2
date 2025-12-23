import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCachedJson } from '@/lib/fetchCached';
import { getClientIp } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';

const Query = z.object({
  q: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(200).optional(),
  mode: z.enum(['search', 'summary']).default('search')
});

export async function GET(req: Request) {
  const ip = getClientIp();
  const rl = rateLimit(`wp:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    title: url.searchParams.get('title') ?? undefined,
    mode: (url.searchParams.get('mode') as any) ?? 'search'
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

  const { mode } = parsed.data;

  if (mode === 'search') {
    const q = (parsed.data.q || '').trim();
    if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 });

    const upstream = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=10`;
    const data = await fetchCachedJson(upstream, { ttlMs: 1000 * 60 * 60 * 24, cacheKey: `wp:search:${q}` });
    return NextResponse.json({ mode, q, data, remaining: rl.remaining });
  }

  const title = (parsed.data.title || '').trim();
  if (!title) return NextResponse.json({ error: 'Missing title' }, { status: 400 });

  const upstream = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data = await fetchCachedJson(upstream, { ttlMs: 1000 * 60 * 60 * 24 * 7, cacheKey: `wp:sum:${title}` });
  return NextResponse.json({ mode, title, data, remaining: rl.remaining });
}
