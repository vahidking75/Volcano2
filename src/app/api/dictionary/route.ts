import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCachedJson } from '@/lib/fetchCached';
import { getClientIp } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';

const Query = z.object({ word: z.string().min(1).max(80) });

export async function GET(req: Request) {
  const ip = getClientIp();
  const rl = rateLimit(`dict:${ip}`, { windowMs: 60_000, max: 30 });
  if (!rl.ok) return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({ word: url.searchParams.get('word') });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid word' }, { status: 400 });

  const word = parsed.data.word.trim();
  try {
    const upstream = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const data = await fetchCachedJson(upstream, { ttlMs: 1000 * 60 * 60 * 24 * 7, cacheKey: `dict:${word}` });
    return NextResponse.json({ word, data, remaining: rl.remaining });
  } catch (e) {
    return NextResponse.json({ word, data: null, error: 'Not found' }, { status: 404 });
  }
}
