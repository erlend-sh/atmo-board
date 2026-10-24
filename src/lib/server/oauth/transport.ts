// One network boundary for every request the OAuth SDK makes: handle and DID
// resolution, PDS discovery, PAR and token calls, and HappyView's own
// /oauth endpoints. Ported from atmoBB (MIT), with plain fetch outside.
import { isIP } from 'node:net';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10_000;

interface Options {
  instanceUrl: string;
  appUrl: string;
  clientKey: string;
}

// Handles and DID documents are attacker-chosen, so they mustn't point the
// server at itself or the private network. (Hostnames that resolve to
// private addresses would need a resolving guard; not attempted here.)
function publicHost(host: string) {
  host = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;
  if (!isIP(host)) return true;
  return !/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::$|f[cd]|fe80:|::ffff:)/.test(host);
}

async function capped(response: Response): Promise<Response> {
  const reader = response.body?.getReader();
  if (!reader) return response;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('OAuth response too large.'); }
    chunks.push(value);
  }
  const body = [204, 205, 304].includes(response.status) ? null : Buffer.concat(chunks);
  return new Response(body, { status: response.status, headers: response.headers });
}

export function happyViewTransport(options: Options): typeof globalThis.fetch {
  const instance = new URL(options.instanceUrl);
  const basePath = instance.pathname.replace(/\/+$/, '');
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.username || url.password || url.hash) throw new Error('OAuth request URL contains credentials or a fragment.');
    const headers = new Headers(request.headers);
    for (const h of ['cookie', 'host', 'proxy-authorization']) headers.delete(h);
    if (headers.has('x-client-secret')) throw new Error('The web OAuth client must not send a client secret.');

    if (url.origin === instance.origin) {
      // HappyView may be internal HTTP. That exception covers only the SDK's
      // own HappyView calls, never a URL taken from a DID document.
      const path = url.pathname.startsWith(`${basePath}/`) ? url.pathname.slice(basePath.length) : '';
      const clientKey = headers.get('x-client-key') === options.clientKey;
      const authenticated = clientKey && /^DPoP \S+$/.test(headers.get('authorization') ?? '') && headers.has('dpop');
      const registration = clientKey && request.method === 'POST' && (path === '/oauth/dpop-keys' || path === '/oauth/sessions');
      const session = authenticated && /^(GET|DELETE)$/.test(request.method) && /^\/oauth\/sessions\/[^/]+$/.test(path);
      const xrpc = authenticated && /^(GET|POST)$/.test(request.method) && /^\/xrpc\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+){2,}$/.test(path);
      if (!registration && !session && !xrpc) throw new Error('Refusing an unexpected request to HappyView.');
      headers.set('origin', new URL(options.appUrl).origin);
      return fetch(new Request(request, {
        headers, redirect: 'error',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]),
      }));
    }

    if (url.protocol !== 'https:') throw new Error('External OAuth requests require HTTPS.');
    if (!publicHost(url.hostname)) throw new Error('Refusing an OAuth request to a private address.');
    if (headers.has('x-client-key') || headers.has('authorization')) throw new Error('Refusing to forward HappyView credentials.');
    if (request.method !== 'GET' && request.method !== 'POST') throw new Error('Unexpected external OAuth request method.');
    headers.delete('origin');
    return capped(await fetch(new Request(request, {
      headers, redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]),
    })));
  };
}
