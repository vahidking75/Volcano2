import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.VOLCANO_DB_PATH || path.join(process.cwd(), 'volcano.db');

let _db: Database.Database | null = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_session ON projects(session_id);
  `);

  return _db;
}

export function cacheGet(key: string, ttlMs: number) {
  const db = getDb();
  const row = db.prepare('SELECT value, created_at FROM cache WHERE key = ?').get(key) as { value: string; created_at: number } | undefined;
  if (!row) return null;
  if (Date.now() - row.created_at > ttlMs) return null;
  return row.value;
}

export function cacheSet(key: string, value: string) {
  const db = getDb();
  db.prepare('INSERT INTO cache(key, value, created_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, created_at=excluded.created_at')
    .run(key, value, Date.now());
}
