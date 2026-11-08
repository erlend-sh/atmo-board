// Browser entry: makes window.mockApi and answers fetch() calls to /xrpc/* from it.
//
// Pages call the API the way they would call a real Group Host:
//   const res = await fetch(`${XRPC}/xrpc/community.lexicon.thread.listThreads?parent=${uri}`)
// With XRPC set to '' (same origin) or 'https://mock.invalid', the mock answers. Point XRPC at a
// real host and drop the script tag to leave the mock.
//
// Options go in the script's query string or data attributes:
//   <script src="mock-api.js" data-as="bob.example" data-latency="150"></script>
//   data-as: sign in as this handle at start. data-latency: ms per request. data-shift-time="false": keep the 2026-10-24 dates.
const script = document.currentScript;
const opt = (k) => script?.dataset[k] ?? new URLSearchParams(location.search).get('mock' + k[0].toUpperCase() + k.slice(1));
const api = createMockApi({ fixtures: FIXTURES, lexicons: LEXICONS, shiftTime: opt('shiftTime') !== 'false' });
if (opt('as')) api.signIn(opt('as'));
const latency = Number(opt('latency') || 0);
api.service = 'https://mock.invalid';

const realFetch = window.fetch.bind(window);
function ours(url) {
  if (url.origin === 'https://mock.invalid') return true;
  return url.pathname.startsWith('/xrpc/') && (url.origin === location.origin || url.protocol === 'file:');
}
window.fetch = async (input, init = {}) => {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input), location.href);
  if (!ours(url)) return realFetch(input, init);
  const method = (init.method || req?.method || 'GET').toUpperCase();
  const body = init.body ?? (req && method !== 'GET' ? await req.text() : undefined);
  if (latency) await new Promise((r) => setTimeout(r, latency));
  const { status, body: out } = await api.handle(method, url.href, body);
  return new Response(JSON.stringify(out), { status, headers: { 'content-type': 'application/json' } });
};
/** Shorthand: await mockApi.xrpc('community.lexicon.thread.getThread', { thread }) for a query, or pass a body for a procedure. Throws on an error response. */
api.xrpc = async (nsid, params = {}, body) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const x of [].concat(v)) if (x !== undefined) qs.append(k, x);
  const res = await window.fetch(`${api.service}/xrpc/${nsid}${qs.size ? '?' + qs : ''}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.message || json.error), { status: res.status, error: json.error });
  return json;
};
api.subscribe((changes) => window.dispatchEvent(new CustomEvent('mockapi:change', { detail: changes })));
window.mockApi = api;
