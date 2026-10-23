// Server-side HappyView XRPC client for scripts (seed, smoke tests). It acts as
// a DID by minting HappyView's signed `happyview_session` cookie with the
// shared SESSION_SECRET, the same trusted first-party path the web app uses.
// Cookie format ported from atmoBB (MIT): cookie-rs SignedJar over an
// HKDF-SHA256 expand-only key.
import { createHmac } from 'node:crypto';

const KEYS_INFO = Buffer.from('COOKIE;SIGNED:HMAC-SHA256;PRIVATE:AEAD-AES-256-GCM');

function hkdfExpand(prk, info, len) {
  const out = [];
  let prev = Buffer.alloc(0);
  for (let i = 1; out.reduce((n, b) => n + b.length, 0) < len; i++) {
    prev = createHmac('sha256', prk).update(prev).update(info).update(Buffer.from([i])).digest();
    out.push(prev);
  }
  return Buffer.concat(out).subarray(0, len);
}

export function mintSessionCookie(secret, did) {
  const key = hkdfExpand(Buffer.from(secret), KEYS_INFO, 64).subarray(0, 32);
  return createHmac('sha256', key).update(Buffer.from(did)).digest('base64') + did;
}

export function client({ url, secret, clientKey, clientSecret }) {
  async function call(method, nsid, { as, params, body } = {}) {
    const target = new URL(`/xrpc/${nsid}`, url);
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) target.searchParams.set(k, String(v));
    const headers = { accept: 'application/json', 'x-client-key': clientKey };
    if (clientSecret) headers['x-client-secret'] = clientSecret;
    if (as) headers.cookie = `happyview_session=${encodeURIComponent(mintSessionCookie(secret, as))}`;
    if (body) headers['content-type'] = 'application/json';
    const res = await fetch(target, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: 'BadResponse', message: text }; }
    if (!res.ok || data?.error) {
      const err = new Error(`${nsid}: ${data?.error ?? res.status} ${data?.message ?? ''}`.trim());
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }
  return {
    query: (nsid, params, as) => call('GET', nsid, { params, as }),
    procedure: (nsid, body, as) => call('POST', nsid, { body, as }),
  };
}
