import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCachedJson } from '@/lib/fetchCached';
import { getClientIp } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';

const Query = z.object({
  mode: z.enum(['search', 'attrs']).default('search'),
  q: z.string().min(1).max(120).optional(),
  id: z.string().min(2).max(20).optional()
});

function sparqlUrl(query: string) {
  const u = new URL('https://query.wikidata.org/sparql');
  u.searchParams.set('format', 'json');
  u.searchParams.set('query', query);
  return u.toString();
}

export async function GET(req: Request) {
  const ip = getClientIp();
  const rl = rateLimit(`wd:${ip}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    mode: (url.searchParams.get('mode') as any) ?? 'search',
    q: url.searchParams.get('q') ?? undefined,
    id: url.searchParams.get('id') ?? undefined
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

  if (parsed.data.mode === 'search') {
    const q = (parsed.data.q || '').trim();
    if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 });

    const upstream = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&format=json&limit=10`;
    const data = await fetchCachedJson(upstream, { ttlMs: 1000 * 60 * 60 * 24 * 7, cacheKey: `wd:search:${q}` });
    return NextResponse.json({ mode: 'search', q, data, remaining: rl.remaining });
  }

  const id = (parsed.data.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // A compact "attribute" query: label, description, instance of, image, location, coordinates when present.
  const q = `
    SELECT ?item ?itemLabel ?itemDescription ?instanceOfLabel ?countryLabel ?locationLabel ?coord ?image WHERE {
      BIND(wd:${id} AS ?item)
      OPTIONAL { ?item wdt:P31 ?instanceOf. }
      OPTIONAL { ?item wdt:P17 ?country. }
      OPTIONAL { ?item wdt:P276 ?location. }
      OPTIONAL { ?item wdt:P625 ?coord. }
      OPTIONAL { ?item wdt:P18 ?image. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 25
  `;

  const upstream = sparqlUrl(q);
  const data = await fetchCachedJson(upstream, { ttlMs: 1000 * 60 * 60 * 24 * 14, cacheKey: `wd:attrs:${id}` });
  return NextResponse.json({ mode: 'attrs', id, data, remaining: rl.remaining });
}
