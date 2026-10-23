import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { config } from './config';

// The browser's own session: a DID signed with ATMOBOARD_COOKIE_SECRET.
const COOKIE = 'ab_session';
const MAX_AGE = 60 * 60 * 24 * 30;

const sign = (value: string) => createHmac('sha256', config.cookieSecret).update(value).digest('base64url');

export function readSession(cookies: Cookies): string | null {
  const raw = cookies.get(COOKIE);
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return null;
  const did = raw.slice(0, dot);
  const mac = Buffer.from(raw.slice(dot + 1));
  const want = Buffer.from(sign(did));
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) return null;
  return /^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/.test(did) ? did : null;
}

export function writeSession(cookies: Cookies, did: string) {
  cookies.set(COOKIE, `${did}.${sign(did)}`, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: MAX_AGE });
}

export function clearSession(cookies: Cookies) {
  cookies.delete(COOKIE, { path: '/' });
}
