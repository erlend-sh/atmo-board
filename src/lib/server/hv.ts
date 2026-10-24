import { createHmac } from 'node:crypto';
import { config } from './config';

// HappyView authenticates XRPC callers with its signed `happyview_session`
// cookie. The web server shares HappyView's SESSION_SECRET, so it can call
// the API as the signed-in member (their writes are authored by them) or as
// the group account (privileged admin procedures). This is internal
// server-to-server auth; these cookies never reach the browser.
// Cookie format ported from atmoBB (MIT): cookie-rs SignedJar, HKDF-SHA256
// expand-only key derivation.
const KEYS_INFO = Buffer.from('COOKIE;SIGNED:HMAC-SHA256;PRIVATE:AEAD-AES-256-GCM');

function hkdfExpand(prk: Buffer, info: Buffer, len: number): Buffer {
  const out: Buffer[] = [];
  let prev = Buffer.alloc(0);
  for (let i = 1; out.reduce((n, b) => n + b.length, 0) < len; i++) {
    prev = createHmac('sha256', prk).update(prev).update(info).update(Buffer.from([i])).digest();
    out.push(prev);
  }
  return Buffer.concat(out).subarray(0, len);
}

let cached: { secret: string; key: Buffer } | null = null;
function signingKey(): Buffer {
  const secret = config.sessionSecret;
  if (cached?.secret !== secret) cached = { secret, key: hkdfExpand(Buffer.from(secret), KEYS_INFO, 64).subarray(0, 32) };
  return cached.key;
}

export function mintSessionCookie(did: string): string {
  return createHmac('sha256', signingKey()).update(Buffer.from(did)).digest('base64') + did;
}

export class XrpcError extends Error {
  constructor(readonly name: string, message: string, readonly status: number) {
    super(message);
  }
}

type Params = Record<string, string | number | undefined | null>;

async function call<T>(method: 'GET' | 'POST', nsid: string, as: string | null, params?: Params, body?: unknown): Promise<T> {
  const url = new URL(`/xrpc/${nsid}`, config.happyviewUrl);
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { accept: 'application/json', 'x-client-key': config.clientKey };
  if (config.clientSecret) headers['x-client-secret'] = config.clientSecret;
  if (as) headers.cookie = `happyview_session=${encodeURIComponent(mintSessionCookie(as))}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new XrpcError('BadResponse', `${nsid}: ${res.status}`, res.status); }
  if (!res.ok || data?.error) {
    const status = data?.error === 'NotFound' ? 404 : data?.error === 'Forbidden' ? 403 : res.ok ? 400 : res.status;
    throw new XrpcError(data?.error ?? 'Error', data?.message ?? data?.error ?? `${nsid} failed`, status);
  }
  return data as T;
}

const NS = 'dev.atmoboard';

/** The atmo-board API, as a given viewer (null for anonymous reads). */
export function api(viewer: string | null) {
  return {
    query: <T>(name: string, params?: Params) => call<T>('GET', `${NS}.${name}`, viewer, params),
    procedure: <T>(name: string, body: unknown) => call<T>('POST', `${NS}.${name}`, viewer, undefined, body),
  };
}

/** The API as the group account, for admin procedures. */
export const groupApi = () => api(config.forumDid);

/** markRead reports a new trust level; only the group can publish it as a role. */
export async function publishTrust(marked: { trustLevel?: number } | undefined, did: string | null) {
  if (marked?.trustLevel === undefined || !did) return;
  await groupApi().procedure('admin.syncMember', { member: did }).catch(() => {});
}
