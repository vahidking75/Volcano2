import { cookies, headers } from 'next/headers';

const COOKIE_NAME = 'vv_session';

export function getSessionId(): string {
  const c = cookies();
  const existing = c.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  // Create a stable anonymous session id.
  const id = crypto.randomUUID();
  c.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
  return id;
}

export function getClientIp(): string {
  const h = headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}
