// Mock Group Host for garden.msg.* — an in-memory indexer over fixture records.
//
// It holds plain records grouped by repo, the way they'd sit in authors' repos or a group's public
// space, and answers the read queries a frontend needs by computing what an indexer would: overrides
// applied, opening posts, counts, posters, latest activity, scores and reaction tallies. Writes go
// through com.atproto.repo.* and only change the in-memory set, so a reload starts over.
//
// No dependencies, so the same file runs in a browser page and in Node (build and tests).

export const NS = 'garden.msg';
const C = {
  group: `${NS}.group`, thread: `${NS}.thread`, post: `${NS}.post`, channel: `${NS}.channel`,
  override: `${NS}.override`, subscription: `${NS}.subscription`, recommend: `${NS}.recommend`,
  reaction: `${NS}.reaction`, profile: 'app.bsky.actor.profile',
};
export const COLLECTIONS = C;
const FOREVER = '9999-12-31T23:59:59.000Z';

// ---------- ids: TIDs, CIDs, at-uris ----------

const S32 = '234567abcdefghijklmnopqrstuvwxyz';
const usedTids = new Set();
/** A TID for a moment in time (ms or ISO string). Unique within this process, sortable like real TIDs. */
export function tidFor(when = Date.now()) {
  let us = (typeof when === 'number' ? when : Date.parse(when)) * 1000;
  while (usedTids.has(us)) us += 1; // same microsecond: bump, as a TID clock would
  usedTids.add(us);
  let n = BigInt(us) << 10n, out = '';
  for (let i = 0; i < 13; i++) { out = S32[Number(n & 31n)] + out; n >>= 5n; }
  return out;
}
export function tidTime(tid) {
  let n = 0n;
  for (const c of tid) n = (n << 5n) | BigInt(S32.indexOf(c));
  return Number(n >> 10n) / 1000;
}

// Small synchronous sha256, so CIDs can be made in the page without awaiting crypto.subtle.
const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(bytes) {
  const l = bytes.length, padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[l] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, l * 8); dv.setUint32(padded.length - 8, Math.floor(l / 0x20000000));
  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32), odv = new DataView(out.buffer);
  h.forEach((v, i) => odv.setUint32(i * 4, v));
  return out;
}
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
export function base32(bytes) {
  let out = '', bits = 0, v = 0;
  for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += B32[(v << (5 - bits)) & 31];
  return out;
}
const utf8 = (s) => new TextEncoder().encode(s);
/** A well-formed CIDv1 (dag-cbor, sha256). Stand-in: it hashes the record's JSON, not its CBOR. */
export function cidFor(record) {
  return 'b' + base32(Uint8Array.of(0x01, 0x71, 0x12, 0x20, ...sha256(utf8(stableJson(record)))));
}
/** The URL key from docs/url-design.md: 10 base32 characters of sha256(at-uri). */
export const keyOf = (uri) => base32(sha256(utf8(uri))).slice(0, 10);
const stableJson = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k2) => [k2, x[k2]])) : x));
export const atUri = (did, collection, rkey) => `at://${did}/${collection}/${rkey}`;
export function parseUri(uri) {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri || '');
  return m ? { repo: m[1], collection: m[2], rkey: m[3] } : null;
}

// ---------- a small validator driven by the lexicon files ----------

const graphemes = (s) => (typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter().segment(s)].length : [...s].length);
const FORMATS = {
  'at-uri': (s) => /^at:\/\/[^/\s]+(\/[^/\s]+(\/[^/\s]+)?)?$/.test(s),
  did: (s) => /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(s),
  datetime: (s) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(s) && !isNaN(Date.parse(s)),
  uri: (s) => /^[a-z][a-z0-9+.-]*:\S+$/i.test(s),
  cid: (s) => /^b[a-z2-7]{20,}$/.test(s),
  handle: (s) => /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]+$/i.test(s),
};
export class XRPCError extends Error {
  constructor(status, error, message) { super(message || error); this.status = status; this.error = error; }
}
function makeValidator(lexicons) {
  const docs = Object.fromEntries(lexicons.map((d) => [d.id, d]));
  const resolve = (ref, base) => {
    const [id, name = 'main'] = ref.startsWith('#') ? [base, ref.slice(1)] : ref.split('#');
    return docs[id]?.defs[name] ? { def: docs[id].defs[name], base: id } : null;
  };
  function check(def, v, path, base) {
    const fail = (m) => { throw new XRPCError(400, 'InvalidRecord', `${path}: ${m}`); };
    switch (def.type) {
      case 'ref': { const r = resolve(def.ref, base); if (r) check(r.def, v, path, r.base); return; }
      case 'union': if (!v || typeof v !== 'object' || typeof v.$type !== 'string') fail('must be an object with $type'); return; // open unions: not looked inside
      case 'unknown': return;
      case 'string':
        if (typeof v !== 'string') fail('must be a string');
        if (def.maxLength && utf8(v).length > def.maxLength) fail(`longer than ${def.maxLength} bytes`);
        if (def.minLength && utf8(v).length < def.minLength) fail(`shorter than ${def.minLength} bytes`);
        if (def.maxGraphemes && graphemes(v) > def.maxGraphemes) fail(`more than ${def.maxGraphemes} graphemes`);
        if (def.format && FORMATS[def.format] && !FORMATS[def.format](v)) fail(`not a valid ${def.format}`);
        return;
      case 'integer':
        if (!Number.isInteger(v)) fail('must be an integer');
        if (def.minimum !== undefined && v < def.minimum) fail(`below ${def.minimum}`);
        if (def.maximum !== undefined && v > def.maximum) fail(`above ${def.maximum}`);
        return;
      case 'boolean': if (typeof v !== 'boolean') fail('must be a boolean'); return;
      case 'array':
        if (!Array.isArray(v)) fail('must be an array');
        if (def.maxLength && v.length > def.maxLength) fail(`more than ${def.maxLength} items`);
        v.forEach((x, i) => check(def.items, x, `${path}[${i}]`, base));
        return;
      case 'blob': if (!v || v.$type !== 'blob') fail('must be a blob'); return;
      case 'object': case 'record': {
        const o = def.type === 'record' ? def.record : def;
        if (!v || typeof v !== 'object' || Array.isArray(v)) fail('must be an object');
        for (const k of o.required || []) if (v[k] === undefined) fail(`missing required field ${k}`);
        for (const [k, p] of Object.entries(o.properties || {})) if (v[k] !== undefined) check(p, v[k], `${path}.${k}`, base);
        return;
      }
    }
  }
  return {
    known: (nsid) => docs[nsid]?.defs.main?.type === 'record',
    record(collection, value) {
      if (!this.known(collection)) return;
      if (value.$type !== collection) throw new XRPCError(400, 'InvalidRecord', `$type must be ${collection}`);
      check(docs[collection].defs.main, value, collection, collection);
    },
  };
}

// ---------- the indexer ----------

/**
 * @param {object} opts
 * @param {object} opts.fixtures  { now, group, staff, repos: { did: { handle, records: { collection: { rkey: record } } } } }
 * @param {object[]} opts.lexicons  lexicon docs, used to validate writes
 * @param {boolean} [opts.shiftTime=true]  move every datetime so the fixtures' "now" is the real now
 * @param {() => number} [opts.clock]
 */
export function createMockApi({ fixtures, lexicons = [], shiftTime = true, clock = () => Date.now() }) {
  const validate = makeValidator(lexicons);
  const listeners = new Set();
  let repos, handles, viewer = null;

  function load() {
    const data = structuredClone(fixtures);
    const shift = shiftTime && data.now ? clock() - Date.parse(data.now) : 0;
    if (shift) shiftDates(data.repos, shift);
    repos = new Map(); handles = new Map();
    for (const [did, r] of Object.entries(data.repos)) {
      const cols = new Map();
      for (const [col, recs] of Object.entries(r.records)) cols.set(col, new Map(Object.entries(recs).map(([rk, v]) => [rk, { value: v, cid: cidFor(v), indexedAt: v.createdAt || v.publishedAt || data.now }])));
      repos.set(did, { handle: r.handle, cols });
      if (r.handle) handles.set(r.handle, did);
    }
  }
  function shiftDates(o, ms) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) && v !== FOREVER) o[k] = new Date(Date.parse(v) + ms).toISOString();
      else if (v && typeof v === 'object') shiftDates(v, ms);
    }
  }
  load();

  const groupUri = fixtures.group;
  const staffSet = () => new Set(fixtures.staff || []);
  const isStaff = (did) => !!did && staffSet().has(did);
  const nowIso = () => new Date(clock()).toISOString();

  // ---- record access ----
  function* all(collection) {
    for (const [did, r] of repos) {
      const m = r.cols.get(collection);
      if (m) for (const [rkey, e] of m) yield { uri: atUri(did, collection, rkey), author: did, rkey, ...e };
    }
  }
  function get(uri) {
    const p = parseUri(uri); if (!p) return null;
    const e = repos.get(p.repo)?.cols.get(p.collection)?.get(p.rkey);
    return e ? { uri, author: p.repo, rkey: p.rkey, ...e } : null;
  }

  // ---- derived state, rebuilt lazily after each write ----
  let idx = null;
  function index() {
    if (idx) return idx;
    const now = clock();
    const containers = new Map([...all(C.thread)].map((e) => [e.uri, e]));
    const groupOwner = (g) => parseUri(g)?.repo;
    const groupOf = (uri) => containers.get(uri)?.value.group ?? get(uri)?.value.site; // container, or an article's publication

    // overrides: only the owner of the subject's group counts, and per (subject, action pair) the newest wins
    const PAIR = { hide: 'hide', unhide: 'hide', lock: 'lock', unlock: 'lock', pin: 'pin', unpin: 'pin', move: 'move', rename: 'rename' };
    const ov = new Map(); // subject -> { pair: record }
    const subjectGroup = (subj) => {
      const s = get(subj); if (!s) return null;
      if (s.uri.includes(`/${C.thread}/`)) return s.value.group;
      if (s.uri.includes(`/${C.post}/`)) return groupOf(s.value.thread);
      return null;
    };
    for (const o of all(C.override)) {
      const v = o.value, pair = PAIR[v.action]; if (!pair) continue;
      if (groupOwner(subjectGroup(v.subject)) !== o.author) continue;
      const m = ov.get(v.subject) ?? new Map(); ov.set(v.subject, m);
      if (!m.has(pair) || m.get(pair).createdAt < v.createdAt) m.set(pair, v);
    }
    const live = (v) => v && (!v.until || Date.parse(v.until) > now);
    function state(subj) {
      const m = ov.get(subj); if (!m) return {};
      const s = {}, h = m.get('hide'), l = m.get('lock'), p = m.get('pin');
      if (h?.action === 'hide' && live(h)) s.hidden = true;
      if (l?.action === 'lock' && live(l)) s.locked = true;
      if (p?.action === 'pin' && live(p)) s.pinnedUntil = p.until || FOREVER;
      return s;
    }
    const moved = (subj) => { const m = ov.get(subj)?.get('move'); return m?.toThread; };
    const renamed = (subj) => ov.get(subj)?.get('rename')?.title;
    const parentOf = (uri) => moved(uri) ?? containers.get(uri)?.value.parent;

    // posts by effective thread, oldest first
    const postsBy = new Map(), replyCount = new Map();
    for (const p of all(C.post)) {
      const t = moved(p.uri) ?? p.value.thread;
      (postsBy.get(t) ?? postsBy.set(t, []).get(t)).push(p);
    }
    for (const list of postsBy.values()) list.sort((a, b) => a.value.createdAt.localeCompare(b.value.createdAt));

    // votes: newest per (author, subject); reactions: one per (author, subject, emoji)
    const votes = new Map();
    for (const r of all(C.recommend)) {
      const k = r.author + ' ' + r.value.subject, cur = votes.get(k);
      if (!cur || cur.value.createdAt < r.value.createdAt) votes.set(k, r);
    }
    const score = new Map(), myVote = new Map();
    for (const r of votes.values()) {
      score.set(r.value.subject, (score.get(r.value.subject) || 0) + (r.value.direction === 'down' ? -1 : 1));
      myVote.set(r.author + ' ' + r.value.subject, r);
    }
    const rx = new Map(), rxSeen = new Set();
    for (const r of [...all(C.reaction)].sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))) {
      const k = `${r.author} ${r.value.subject} ${r.value.emoji}`; if (rxSeen.has(k)) continue; rxSeen.add(k);
      (rx.get(r.value.subject) ?? rx.set(r.value.subject, []).get(r.value.subject)).push(r);
    }

    // channels featured by the group's owner
    const channels = [...all(C.channel)].filter((c) => {
      const t = containers.get(c.value.thread);
      return t && !t.value.parent && groupOwner(t.value.group) === c.author;
    });
    const channelOf = new Map(channels.map((c) => [c.value.thread, c]));

    const subs = [...all(C.subscription)];
    idx = { containers, postsBy, replyCount, score, myVote, rx, channels, channelOf, subs, state, parentOf, renamed, groupOf };
    for (const list of postsBy.values()) for (const p of list) if (p.value.replyTo && !state(p.uri).hidden) replyCount.set(p.value.replyTo, (replyCount.get(p.value.replyTo) || 0) + 1);
    return idx;
  }
  const dirty = () => { idx = null; };

  // ---- views ----
  const canSee = (uri) => !index().state(uri).hidden || isStaff(viewer);
  const visiblePosts = (thread) => (index().postsBy.get(thread) || []).filter((p) => canSee(p.uri));

  function excerptOf(text) {
    let t = text.split(/\n\s*\n/).slice(0, 3).join('\n\n').trim();
    if (graphemes(t) > 300) t = [...new Intl.Segmenter().segment(t)].slice(0, 299).map((s) => s.segment).join('').trimEnd() + '…';
    return t;
  }
  function opOf(c) {
    return (index().postsBy.get(c.uri) || []).find((p) => p.author === c.author && !p.value.replyTo && p.value.thread === c.uri);
  }
  function viewerFor(subject) {
    if (!viewer) return undefined;
    const I = index(), v = {};
    const vote = I.myVote.get(viewer + ' ' + subject);
    if (vote) { v.recommend = vote.uri; v.direction = vote.value.direction || 'up'; }
    const mine = (I.rx.get(subject) || []).filter((r) => r.author === viewer).map((r) => ({ emoji: r.value.emoji, uri: r.uri }));
    if (mine.length) v.reactions = mine;
    return v;
  }
  function threadSubscription(threadUri) {
    if (!viewer) return {};
    const I = index(), mine = I.subs.filter((s) => s.author === viewer);
    const group = I.containers.get(threadUri)?.value.group;
    for (let t = threadUri, first = true; t; t = I.parentOf(t), first = false) {
      const s = mine.filter((x) => x.value.thread === t && x.value.group === group).sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))[0];
      if (s) return { ...(first ? { subscription: s.uri } : {}), notify: s.value.notify || 'posts' };
    }
    const g = mine.find((x) => x.value.group === group && !x.value.thread);
    return g ? { notify: g.value.notify || 'threads' } : {};
  }
  function threadView(c) {
    const I = index(), posts = visiblePosts(c.uri), op = opOf(c);
    const st = I.state(c.uri);
    const authors = [], seen = new Set();
    for (const p of [...(op ? [op] : []), ...posts.slice().reverse()]) if (!seen.has(p.author)) { seen.add(p.author); authors.push(p.author); }
    const v = {
      uri: c.uri, cid: c.cid, author: c.author, record: c.value,
      ...(I.renamed(c.uri) ? { title: I.renamed(c.uri) } : {}),
      ...(I.parentOf(c.uri) && I.parentOf(c.uri) !== c.value.parent ? { parent: I.parentOf(c.uri) } : {}),
      ...(op ? { opening: op.uri } : {}),
      ...((c.value.description || op) ? { excerpt: excerptOf(c.value.description || op.value.textContent) } : {}),
      postCount: posts.length,
      posters: authors.slice(0, 5),
      ...(posts.length ? { lastPostAt: posts[posts.length - 1].value.createdAt } : {}),
      score: I.score.get(c.uri) || 0,
      ...(Object.keys(st).length ? { state: st } : {}),
      indexedAt: c.indexedAt,
    };
    if (viewer) v.viewer = { ...viewerFor(c.uri), ...threadSubscription(c.uri) };
    return v;
  }
  function tally(subject) {
    const counts = new Map();
    for (const r of index().rx.get(subject) || []) counts.set(r.value.emoji, (counts.get(r.value.emoji) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([emoji, count]) => ({ emoji, count }));
  }
  function postView(p) {
    const I = index(), st = I.state(p.uri), reactions = tally(p.uri);
    return {
      uri: p.uri, cid: p.cid, author: p.author, record: p.value,
      replyCount: I.replyCount.get(p.uri) || 0,
      score: I.score.get(p.uri) || 0,
      ...(reactions.length ? { reactions } : {}),
      ...(Object.keys(st).length ? { state: st } : {}),
      indexedAt: p.indexedAt,
      ...(viewer ? { viewer: viewerFor(p.uri) } : {}),
    };
  }
  const page = (items, { limit = 50, cursor }) => {
    const start = cursor ? Number(cursor) : 0, end = start + Number(limit);
    return { items: items.slice(start, end), cursor: end < items.length ? String(end) : undefined };
  };
  const lastActivity = (v) => v.lastPostAt || v.record.publishedAt;
  const needUri = (v, name) => { if (!v || !parseUri(v)) throw new XRPCError(400, 'InvalidRequest', `${name} must be an at-uri of a record`); return v; };

  // ---- XRPC methods ----
  const queries = {
    [`${NS}.getGroup`]({ group }) {
      const g = get(needUri(group, 'group'));
      if (!g || !g.uri.includes(`/${C.group}/`)) throw new XRPCError(400, 'NotFound', 'No such group');
      const I = index();
      const descendants = (uri) => { let n = 0; for (const c of I.containers.values()) if (I.parentOf(c.uri) === uri && canSee(c.uri)) n += 1 + descendants(c.uri); return n; };
      const channels = I.channels
        .filter((c) => I.containers.get(c.value.thread).value.group === group && canSee(c.value.thread))
        .sort((a, b) => (a.value.section || '').localeCompare(b.value.section || '') || a.value.position - b.value.position)
        .map((c) => {
          const t = I.containers.get(c.value.thread);
          return {
            uri: c.uri, ...(c.value.section ? { section: c.value.section } : {}), position: c.value.position,
            ...(c.value.icon ? { icon: c.value.icon } : {}),
            ...((c.value.description || t.value.description) ? { description: c.value.description || t.value.description } : {}),
            thread: threadView(t), threadCount: descendants(t.uri),
          };
        });
      // keep sections in the order of their first channel's position in the group's own list
      const order = [...new Set((fixtures.sections || []).concat(channels.map((c) => c.section || '')))];
      channels.sort((a, b) => order.indexOf(a.section || '') - order.indexOf(b.section || '') || a.position - b.position);
      const members = new Set(I.subs.filter((s) => s.value.group === group && !s.value.thread).map((s) => s.author));
      const out = { uri: g.uri, cid: g.cid, author: g.author, record: g.value, channels, memberCount: members.size, staff: [...staffSet()] };
      if (viewer) {
        const s = I.subs.find((x) => x.author === viewer && x.value.group === group && !x.value.thread);
        out.viewer = { ...(s ? { subscription: s.uri, notify: s.value.notify || 'threads' } : {}), staff: isStaff(viewer) };
      }
      return out;
    },
    [`${NS}.listThreads`]({ parent, group, sort = 'latest', tag, limit, cursor }) {
      const I = index();
      if (!parent && !group) throw new XRPCError(400, 'InvalidRequest', 'parent or group is required');
      let list = [...I.containers.values()].filter((c) => canSee(c.uri));
      if (parent) list = list.filter((c) => I.parentOf(c.uri) === parent);
      else list = list.filter((c) => c.value.group === group && !I.channelOf.has(c.uri));
      if (tag) list = list.filter((c) => (c.value.tags || []).includes(tag));
      let views = list.map(threadView);
      const by = {
        latest: (a, b) => lastActivity(b).localeCompare(lastActivity(a)),
        new: (a, b) => b.record.publishedAt.localeCompare(a.record.publishedAt),
        top: (a, b) => b.score - a.score || lastActivity(b).localeCompare(lastActivity(a)),
      }[sort] || ((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
      const pinned = (v) => (parent && v.state?.pinnedUntil ? 1 : 0);
      views.sort((a, b) => pinned(b) - pinned(a) || by(a, b));
      const { items, cursor: next } = page(views, { limit, cursor });
      return { threads: items, ...(next ? { cursor: next } : {}) };
    },
    [`${NS}.getThread`]({ thread, order = 'oldest', limit = 100, cursor }) {
      needUri(thread, 'thread');
      const c = index().containers.get(thread);
      if (c && !canSee(c.uri)) throw new XRPCError(400, 'NotFound', 'Thread is hidden');
      if (!c && !get(thread)) throw new XRPCError(400, 'NotFound', 'No such thread');
      let posts = visiblePosts(thread);
      if (order === 'newest') posts = posts.slice().reverse();
      const { items, cursor: next } = page(posts, { limit, cursor });
      return { ...(c ? { thread: threadView(c) } : {}), posts: items.map(postView), ...(next ? { cursor: next } : {}) };
    },
    [`${NS}.listReactions`]({ subject, emoji, limit, cursor }) {
      let list = index().rx.get(needUri(subject, 'subject')) || [];
      if (emoji) list = list.filter((r) => r.value.emoji === emoji);
      const { items, cursor: next } = page(list, { limit, cursor });
      return { subject, reactions: items.map((r) => ({ uri: r.uri, actor: r.author, emoji: r.value.emoji, createdAt: r.value.createdAt })), ...(next ? { cursor: next } : {}) };
    },

    // ---- the bits of com.atproto and app.bsky a frontend also calls ----
    'app.bsky.actor.getProfile': ({ actor }) => profile(actor),
    'app.bsky.actor.getProfiles'({ actors }) {
      return { profiles: [].concat(actors || []).map((a) => { try { return profile(a); } catch { return null; } }).filter(Boolean) };
    },
    'com.atproto.identity.resolveHandle'({ handle }) {
      const did = handles.get(handle); if (!did) throw new XRPCError(400, 'HandleNotFound', 'Unknown handle');
      return { did };
    },
    'com.atproto.server.getSession'() {
      if (!viewer) throw new XRPCError(401, 'AuthRequired', 'Not signed in: call mockApi.signIn(handle)');
      return { did: viewer, handle: repos.get(viewer)?.handle, active: true };
    },
    'com.atproto.repo.getRecord'({ repo, collection, rkey }) {
      const e = get(atUri(didOf(repo), collection, rkey));
      if (!e) throw new XRPCError(400, 'RecordNotFound', 'Could not locate record');
      return { uri: e.uri, cid: e.cid, value: e.value };
    },
    'com.atproto.repo.listRecords'({ repo, collection, limit = 50, cursor, reverse }) {
      const m = repos.get(didOf(repo))?.cols.get(collection) || new Map();
      let keys = [...m.keys()].sort().reverse(); // newest first, like a PDS
      if (reverse === true || reverse === 'true') keys.reverse();
      if (cursor) keys = keys.filter((k) => (reverse === true || reverse === 'true' ? k > cursor : k < cursor));
      keys = keys.slice(0, Number(limit));
      const records = keys.map((k) => ({ uri: atUri(didOf(repo), collection, k), cid: m.get(k).cid, value: m.get(k).value }));
      return { records, ...(keys.length === Number(limit) ? { cursor: keys[keys.length - 1] } : {}) };
    },
  };
  function didOf(actor) {
    if (!actor) throw new XRPCError(400, 'InvalidRequest', 'actor is required');
    if (actor.startsWith('did:')) return actor;
    const d = handles.get(actor); if (!d) throw new XRPCError(400, 'InvalidRequest', `Unknown handle ${actor}`);
    return d;
  }
  function profile(actor) {
    const did = didOf(actor), r = repos.get(did);
    if (!r) throw new XRPCError(400, 'InvalidRequest', 'Profile not found');
    const p = r.cols.get(C.profile)?.get('self')?.value;
    return { did, handle: r.handle || 'handle.invalid', ...(p?.displayName ? { displayName: p.displayName } : {}), ...(p?.description ? { description: p.description } : {}) };
  }

  // ---- writes ----
  function authRepo(repo) {
    if (!viewer) throw new XRPCError(401, 'AuthRequired', 'Not signed in: call mockApi.signIn(handle)');
    const did = didOf(repo);
    const groupRepo = parseUri(groupUri)?.repo;
    if (did !== viewer && !(did === groupRepo && isStaff(viewer))) throw new XRPCError(403, 'Forbidden', `Signed in as ${viewer}, can't write to ${did}`);
    return did;
  }
  // An indexer can't stop anyone writing to their own repo, but it would ignore these, so the mock refuses them to make it visible.
  function enforce(did, collection, value) {
    validate.record(collection, value);
    if (isStaff(viewer)) return;
    const I = index();
    const target = collection === C.post ? value.thread : collection === C.thread ? value.parent : null;
    if (target && I.state(target).locked) throw new XRPCError(400, 'Locked', 'This thread is locked: only staff can post in it');
    if (collection === C.override || collection === C.channel) throw new XRPCError(403, 'Forbidden', 'Only staff can write overrides and channels');
  }
  function write(op, did, collection, rkey, value) {
    const r = repos.get(did) ?? repos.set(did, { handle: undefined, cols: new Map() }).get(did);
    const m = r.cols.get(collection) ?? r.cols.set(collection, new Map()).get(collection);
    const uri = atUri(did, collection, rkey);
    if (op === 'delete') { if (!m.delete(rkey)) throw new XRPCError(400, 'RecordNotFound', 'Could not locate record'); return { uri }; }
    if (op === 'create' && m.has(rkey)) throw new XRPCError(400, 'InvalidRequest', `Record already exists: ${uri}`);
    validate.record(collection, value);
    const e = { value: structuredClone(value), cid: cidFor(value), indexedAt: nowIso() };
    m.set(rkey, e);
    return { uri, cid: e.cid };
  }
  function emit(changes) {
    dirty();
    for (const fn of listeners) try { fn(changes); } catch (err) { console.error(err); }
  }
  const procedures = {
    'com.atproto.repo.createRecord'({ repo, collection, rkey, record }) {
      const did = authRepo(repo); enforce(did, collection, record);
      const res = write('create', did, collection, rkey || tidFor(clock()), record);
      emit([{ action: 'create', ...res }]); return { ...res, validationStatus: validate.known(collection) ? 'valid' : 'unknown' };
    },
    'com.atproto.repo.putRecord'({ repo, collection, rkey, record }) {
      const did = authRepo(repo); enforce(did, collection, record);
      const res = write('update', did, collection, rkey, record);
      emit([{ action: 'update', ...res }]); return res;
    },
    'com.atproto.repo.deleteRecord'({ repo, collection, rkey }) {
      const did = authRepo(repo);
      const res = write('delete', did, collection, rkey);
      emit([{ action: 'delete', ...res }]); return {};
    },
    'com.atproto.repo.applyWrites'({ repo, writes }) {
      const did = authRepo(repo);
      const snapshot = new Map([...repos].map(([d, r]) => [d, { handle: r.handle, cols: new Map([...r.cols].map(([c, m]) => [c, new Map(m)])) }]));
      const results = [], changes = [];
      try {
        for (const w of writes) {
          const op = (w.$type || '').split('#')[1];
          if (op === 'delete') { const res = write('delete', did, w.collection, w.rkey); results.push({ $type: 'com.atproto.repo.applyWrites#deleteResult' }); changes.push({ action: 'delete', ...res }); continue; }
          if (op !== 'create' && op !== 'update') throw new XRPCError(400, 'InvalidRequest', `Unknown write ${w.$type}`);
          enforce(did, w.collection, w.value);
          dirty(); // later writes in the batch may point at earlier ones
          const res = write(op, did, w.collection, w.rkey || tidFor(clock()), w.value);
          results.push({ $type: `com.atproto.repo.applyWrites#${op}Result`, ...res }); changes.push({ action: op, ...res });
        }
      } catch (err) { repos = snapshot; dirty(); throw err; }
      emit(changes); return { results };
    },
  };

  // ---- public surface ----
  async function call(nsid, params = {}, input) {
    if (queries[nsid]) return structuredClone(queries[nsid](params));
    if (procedures[nsid]) return procedures[nsid](input || {});
    throw new XRPCError(501, 'MethodNotImplemented', `${nsid} is not served by the mock`);
  }
  /** Answer an XRPC request the way a server would. Returns { status, body }. */
  async function handle(method, url, body) {
    const u = new URL(url, 'http://mock.invalid');
    const nsid = u.pathname.replace(/^.*\/xrpc\//, '');
    const params = {};
    for (const [k, v] of u.searchParams) params[k] = k in params ? [].concat(params[k], v) : v;
    for (const k of ['limit']) if (params[k] !== undefined) params[k] = Number(params[k]);
    try {
      if (method === 'GET' && !queries[nsid] && procedures[nsid]) throw new XRPCError(405, 'InvalidRequest', `${nsid} is a procedure: use POST`);
      return { status: 200, body: await call(nsid, params, body ? (typeof body === 'string' ? JSON.parse(body) : body) : undefined) };
    } catch (err) {
      if (err instanceof XRPCError) return { status: err.status, body: { error: err.error, message: err.message } };
      return { status: 500, body: { error: 'InternalServerError', message: String(err?.message || err) } };
    }
  }
  return {
    call, handle, methods: [...Object.keys(queries), ...Object.keys(procedures)].sort(),
    group: groupUri,
    get viewer() { return viewer; },
    /** Sign in as a fixture account (handle or DID), or null to browse as a visitor. */
    signIn(actor) { viewer = actor ? didOf(actor) : null; if (viewer && !repos.has(viewer)) throw new Error(`No repo for ${actor}`); dirty(); emit([{ action: 'signIn', did: viewer }]); return viewer; },
    signOut() { return this.signIn(null); },
    accounts() { return [...repos].filter(([, r]) => r.handle).map(([did, r]) => ({ did, handle: r.handle, displayName: r.cols.get(C.profile)?.get('self')?.value.displayName, staff: isStaff(did) })); },
    /** Called with a list of changes after every write: [{ action, uri, cid }]. Returns an unsubscribe function. */
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reset() { load(); emit([{ action: 'reset' }]); },
    /** Raw access, for debugging: every record in the store. */
    dump() { const o = {}; for (const [d, r] of repos) o[d] = Object.fromEntries([...r.cols].map(([c, m]) => [c, Object.fromEntries([...m].map(([k, e]) => [k, e.value]))])); return o; },
    keyOf, tid: () => tidFor(clock()),
  };
}
