import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionId } from '@/lib/session';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const sessionId = getSessionId();
  const db = getDb();
  const row = db.prepare('SELECT id, name, payload, updated_at FROM projects WHERE id = ? AND session_id = ?')
    .get(params.id, sessionId) as { id: string; name: string; payload: string; updated_at: number } | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ id: row.id, name: row.name, payload: JSON.parse(row.payload), updated_at: row.updated_at });
}
