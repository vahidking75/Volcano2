import { cacheGet, cacheSet } from './db';

export async function fetchCachedJson(url: string, opts: { ttlMs: number; cacheKey?: string } = { ttlMs: 1000 * 60 * 60 }) {
  const key = opts.cacheKey || `url:${url}`;
  const cached = cacheGet(key, opts.ttlMs);
  if (cached) return JSON.parse(cached);

  const res = await fetch(url, {
    headers: {
      'user-agent': 'VolcanoVirtuoso/1.0 (+https://example.invalid)',
      'accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Upstream request failed (${res.status})`);
  }
  const data = await res.json();
  cacheSet(key, JSON.stringify(data));
  return data;
}
