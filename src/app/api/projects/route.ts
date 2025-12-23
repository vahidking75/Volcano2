import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { getSessionId, getClientIp } from '@/lib/session';
import { rateLimit } from '@/lib/rateLimit';

const SaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(60),
  payload: z.any()
});

export async function GET() {
  const sessionId = getSessionId();
  const db = getDb();
  const rows = db.prepare('SELECT id, name, updated_at FROM projects WHERE session_id = ? ORDER BY updated_at DESC LIMIT 50')
    .all(sessionId) as { id: string; name: string; updated_at: number }[];
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const ip = getClientIp();
  const rl = rateLimit(`proj:${ip}`, { windowMs: 60_000, max: 60 });
  if (!rl.ok) return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 });

  const sessionId = getSessionId();
  const json = await req.json().catch(() => null);
  const parsed = SaveSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const db = getDb();
  const id = parsed.data.id || crypto.randomUUID();
  db.prepare(
    'INSERT INTO projects(id, session_id, name, payload, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, payload=excluded.payload, updated_at=excluded.updated_at'
  ).run(id, sessionId, parsed.data.name, JSON.stringify(parsed.data.payload), Date.now());

  return NextResponse.json({ id, ok: true, remaining: rl.remaining });
}

const DeleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  const sessionId = getSessionId();
  const json = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ? AND session_id = ?').run(parsed.data.id, sessionId);
  return NextResponse.json({ ok: true });
}
