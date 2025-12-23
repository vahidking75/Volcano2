import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCachedJson } from '@/lib/fetchCached';
import { getClientIp } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';

const Query = z.object({
  term: z.string().min(1).max(80),
  topics: z.string().optional(),
  max: z.string().optional(),
  flavors: z.string().optional()
});

type Word = { word: string; score?: number; tags?: string[] };

function uniqBy<T>(arr: T[], key: (t: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export async function GET(req: Request) {
  const ip = getClientIp();
  const rl = rateLimit(`datamuse:${ip}`, { windowMs: 60_000, max: 90 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    term: url.searchParams.get('term'),
    topics: url.searchParams.get('topics') || undefined,
    max: url.searchParams.get('max') || undefined,
    flavors: url.searchParams.get('flavors') || undefined
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { term, topics } = parsed.data;
  const max = Math.min(50, Math.max(5, Number(parsed.data.max || 25)));
  const flavors = (parsed.data.flavors || 'ml,syn,trg').split(',').map(s => s.trim()).filter(Boolean);

  // Datamuse supports multiple "rel_*" and "ml" strategies. We merge + rank.
  const base = 'https://api.datamuse.com/words';
  const requests: Promise<Word[]>[] = [];

  const common = new URLSearchParams();
  common.set('max', String(max));
  if (topics) common.set('topics', topics);

  for (const f of flavors) {
    const p = new URLSearchParams(common);
    if (f === 'ml') p.set('ml', term);
    else if (f === 'syn') p.set('rel_syn', term);
    else if (f === 'trg') p.set('rel_trg', term);
    else if (f === 'adj') p.set('rel_jjb', term); // adjectives that often modify term
    else if (f === 'noun') p.set('rel_jja', term); // nouns often modified by term
    else continue;

    const u = `${base}?${p.toString()}`;
    requests.push(fetchCachedJson(u, { ttlMs: 1000 * 60 * 60 * 24, cacheKey: `dm:${f}:${topics || ''}:${term}:${max}` }));
  }

  const results = (await Promise.all(requests)).flat();

  // Merge, then light rerank: prefer high score, shorter words, no spaces.
  const merged = uniqBy(results, r => r.word)
    .map(r => ({
      word: r.word,
      score: r.score || 0,
      penalty: (r.word.includes(' ') ? 60 : 0) + (r.word.length > 18 ? 30 : 0)
    }))
    .sort((a, b) => (b.score - b.penalty) - (a.score - a.penalty))
    .slice(0, max);

  return NextResponse.json({ term, topics: topics || null, items: merged, remaining: rl.remaining, resetAt: rl.resetAt });
}
