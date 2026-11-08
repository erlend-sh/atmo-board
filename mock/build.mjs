// Builds the mock API's fixtures and the one-file browser bundle.
//
//   node build.mjs
//
// 1. Turns sample-data/data.json (real threads from discourse.atmosphere.community, see design/sample-data)
//    into plain garden.msg.* records, grouped by the repo that would write them.
// 2. Validates every record against lexicons/ with @atproto/lexicon.
// 3. Writes fixtures.json, and dist/mock-api.js: src/core.js plus the fixtures and lexicons inlined,
//    so a page opened from file:// can load it with one <script> tag.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Lexicons } from '@atproto/lexicon';
import { NS, COLLECTIONS as C, tidFor, atUri } from './src/core.js';

const here = (p) => new URL(p, import.meta.url);
const data = JSON.parse(readFileSync(here('sample-data/data.json')));
const NOW = '2026-10-24T11:00:00.000Z'; // when the sample was taken; the mock shifts it to the real now
const iso = (s) => new Date(s).toISOString();
const minsAgo = (m) => new Date(Date.parse(NOW) - m * 60000).toISOString();

// ---------- accounts ----------
const GROUP_DID = 'did:web:atmosphere.community';
const repos = {};
const repo = (did, handle) => (repos[did] ??= { handle, records: {} });
const put = (did, collection, rkey, value) => {
  const r = repos[did].records[collection] ??= {};
  if (r[rkey]) throw new Error(`duplicate ${did}/${collection}/${rkey}`);
  r[rkey] = { $type: collection, ...value };
  return atUri(did, collection, rkey);
};
const plcFor = (h) => 'did:plc:' + createHash('sha256').update(h).digest('base64url').replace(/[^a-z2-7]/gi, '').toLowerCase().replace(/[^a-z2-7]/g, 'a').slice(0, 24);
// Discourse usernames without a dot aren't handles; give them one under a reserved TLD.
const handleOf = (u) => (u.includes('.') ? u.toLowerCase() : `${u.toLowerCase().replace(/_/g, '-')}.discourse.example`);
const DID = {};
function account(u, displayName) {
  if (DID[u]) return DID[u];
  const handle = handleOf(u), did = plcFor(handle);
  repo(did, handle);
  if (displayName && displayName !== u) put(did, C.profile, 'self', { displayName });
  return (DID[u] = did);
}
repo(GROUP_DID, 'atmosphere.community');
for (const m of data.members) account(m.u, m.n);
// The preview's made-up viewers, so every role can be tried: a moderator, a member, a newcomer who hasn't joined, and a spammer.
const SAMPLE = { maya: 'Maya Okafor', bob: 'Bob Tanaka', carol: 'Carol Nyberg', spam: 'Grow Fast' };
for (const [u, n] of Object.entries(SAMPLE)) { DID[u] = 'did:plc:sample' + u.padEnd(18, 'x'); repo(DID[u], `${u}.example`); put(DID[u], C.profile, 'self', { displayName: n }); }
const STAFF = [...data.members.filter((m) => m.admin).map((m) => DID[m.u]), DID.maya];

// ---------- the group and its channels ----------
const FOUNDED = '2025-01-15T12:00:00.000Z';
const GROUP = put(GROUP_DID, C.group, tidFor(FOUNDED), {
  url: 'https://our.atmosphere.community', name: 'Atmosphere Community',
  description: 'A community forum for the AT Protocol: lexicons, working groups, events and projects.',
  preferences: { showInDiscover: true },
});
const channels = [...data.channels];
for (const t of data.threads) if (!channels.some((c) => c.title === t.ch)) channels.push({ title: t.ch, section: 'Working Groups', desc: 'A Working Groups subcategory.' });
const CH = {}, positions = {};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
for (const [i, c] of channels.entries()) {
  const at = new Date(Date.parse(FOUNDED) + (i + 1) * 3600e3).toISOString();
  CH[c.title] = put(GROUP_DID, C.thread, tidFor(at), {
    group: GROUP, title: c.title, path: `/c/${slug(c.title)}`, publishedAt: at, ...(c.desc ? { description: c.desc } : {}),
  });
  const position = (positions[c.section] = (positions[c.section] ?? -1) + 1);
  put(GROUP_DID, C.channel, tidFor(at), { thread: CH[c.title], section: c.section, position, createdAt: at });
}
const SECTIONS = [...new Set(channels.map((c) => c.section))];

// ---------- posts ----------
// Post text in the sample is markdown (`text`), or a verbatim opening (q) plus a summary of the rest (s).
const cleanAnchors = (s) => s.replace(/#p-\d+-[a-z0-9-]*?-\d+(?=[^a-z0-9-]|$)/g, '');
function markdownOf(p) {
  if (p.text) return cleanAnchors(p.text);
  let t = p.q || '';
  if (t && t.length >= 100 && !/[.?!:)”"]$/.test(t)) t += '…';
  if (p.s) t += (t ? '\n\n' : '') + '*' + p.s + '*';
  return t;
}
function plain(md) {
  return md
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[image\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => (t === u || u.startsWith('#') ? t : `${t} (${u})`))
    .replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2').replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n').trim();
}
// Deterministic picks, so a rebuild gives the same fixtures.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const people = data.members.map((m) => m.u);
const pickOthers = (n, not) => { const out = new Set(); while (out.size < Math.min(n, people.length - 1)) { const u = people[Math.floor(rand() * people.length)]; if (u !== not) out.add(u); } return [...out]; };
const later = (at, mins) => { const t = Math.min(Date.parse(at) + mins * 60000, Date.parse(NOW) - 60000); return new Date(Math.max(t, Date.parse(at) + 1000)).toISOString(); };

// garden.msg.post caps textContent and defs#markdown at 100,000 graphemes; anything longer is cut.
const seg = new Intl.Segmenter();
let cut = 0;
const fit = (s) => { const g = [...seg.segment(s)]; if (g.length <= 100000) return s; cut++; return g.slice(0, 99999).map((x) => x.segment).join('') + '…'; };
function addPost(u, thread, at, md, { replyTo } = {}) {
  const did = account(u);
  const text = fit(plain(md)); md = fit(md);
  return put(did, C.post, tidFor(at), {
    thread, ...(replyTo ? { replyTo } : {}), textContent: text, ...(md !== text ? { content: { $type: `${NS}.defs#markdown`, text: md } } : {}), createdAt: at,
  });
}
function react(subject, users, emoji, at) {
  for (const [i, u] of users.entries()) put(account(u), C.reaction, tidFor(later(at, 7 + i * 13)), { subject, emoji, createdAt: later(at, 7 + i * 13) });
}

const THREAD = {}, OP = {};
let dropped = 0;
for (const t of data.threads) {
  const first = t.posts[0], at = iso(first.at);
  const uri = put(account(first.u), C.thread, tidFor(at), {
    group: GROUP, parent: CH[t.ch], title: t.title, path: `/t/${slug(t.title)}`, ...(t.tags?.length ? { tags: t.tags } : {}), publishedAt: at,
  });
  THREAD[t.id] = uri;
  const byNumber = {};
  t.posts.forEach((p, i) => {
    if (p.whisper) { dropped++; return; } // staff-only posts belong in a private space, which the public fixtures don't model
    const when = iso(p.at), replyTo = p.re && byNumber[p.re];
    const puri = (byNumber[i + 1] = addPost(p.u, uri, when, markdownOf(p), { replyTo }));
    if (i === 0) OP[t.id] = puri;
    if (p.likes) {
      const likers = pickOthers(p.likes, p.u);
      react(puri, likers, '❤️', when);
      // Discourse has no topic votes, so the opening post's likers stand in as the thread's recommends
      if (i === 0) for (const [k, u] of likers.entries()) put(account(u), C.recommend, tidFor(later(when, 9 + k * 11)), { subject: uri, createdAt: later(when, 9 + k * 11) });
    }
  });
}

// ---------- sample chat and moderation (made up, as in the preview) ----------
const chat = [
  ['bob', 'anyone going to IETF 127 in SF?', 26 * 60],
  ['maya', "I am, for the hackathon. There's a thread in Event Planning.", 25 * 60, [['bob'], '👍']],
  ['spam', 'Grow your followers 10x overnight 🚀 [growfast.example](https://growfast.example)', 90],
  ['carol', 'hi everyone, just found this place 👋', 40, [['bob', 'maya'], '👋']],
  ['bob', 'welcome carol!', 38],
];
let spamPost;
for (const [u, text, ago, rx] of chat) {
  const p = addPost(u, CH.Discussion, minsAgo(ago), text);
  if (u === 'spam') spamPost = p;
  if (rx) for (const [i, w] of rx[0].entries()) put(DID[w], C.reaction, tidFor(minsAgo(ago - 1 - i)), { subject: p, emoji: rx[1], createdAt: minsAgo(ago - 1 - i) });
}
const override = (subject, action, at, extra = {}) => put(GROUP_DID, C.override, tidFor(at), { subject, action, actor: DID.maya, createdAt: at, ...extra });
override(spamPost, 'hide', minsAgo(80), { reason: 'Spam' });
override(CH['ATP IETF Mailing List'], 'lock', '2025-06-01T12:00:00.000Z', { reason: 'Posts here arrive from the IETF atp mailing list.', actor: DID[data.members.find((m) => m.admin).u] });
override(THREAD[761], 'pin', '2026-09-01T12:00:00.000Z', { reason: 'The working group thread.' });
// a down vote, so the direction field has something to show
put(DID.bob, C.recommend, tidFor(minsAgo(300)), { subject: THREAD[1264], direction: 'down', createdAt: minsAgo(300) });

// ---------- subscriptions ----------
// Every member has joined. Carol (newcomer) and the spammer haven't.
for (const [did, r] of Object.entries(repos)) {
  if (did === GROUP_DID || did === DID.carol || did === DID.spam) continue;
  const at = '2025-03-01T12:00:00.000Z';
  put(did, C.subscription, tidFor(at), { group: GROUP, createdAt: at });
}
put(DID.bob, C.subscription, tidFor(minsAgo(5000)), { group: GROUP, thread: THREAD[877], notify: 'posts', createdAt: minsAgo(5000) });
put(DID.bob, C.subscription, tidFor(minsAgo(6000)), { group: GROUP, thread: CH['Event Planning'], notify: 'none', createdAt: minsAgo(6000) });
put(DID.maya, C.subscription, tidFor(minsAgo(9000)), { group: GROUP, thread: CH['Discourse Forum Meta'], notify: 'posts', createdAt: minsAgo(9000) });

// ---------- validate ----------
const lexDir = here('lexicons/'), lexicons = [];
for (const f of readdirSync(lexDir, { recursive: true })) if (f.endsWith('.json')) lexicons.push(JSON.parse(readFileSync(new URL(f, lexDir))));
const lex = new Lexicons(lexicons);
let n = 0;
for (const [did, r] of Object.entries(repos)) for (const [col, recs] of Object.entries(r.records)) for (const [rk, v] of Object.entries(recs)) {
  try { lex.assertValidRecord(col, v); n++; } catch (e) { throw new Error(`${atUri(did, col, rk)}: ${e.message}`); }
}

// ---------- write ----------
const fixtures = {
  $comment: 'Generated by build.mjs from sample-data/data.json (discourse.atmosphere.community, fetched 2026-10-24). Records grouped by the repo that writes them. Reactions and recommends are derived from Discourse likes; the sample members, chat and moderation are made up.',
  now: NOW, group: GROUP, staff: STAFF, sections: SECTIONS, repos,
};
writeFileSync(here('fixtures.json'), JSON.stringify(fixtures, null, 1) + '\n');
mkdirSync(here('dist/'), { recursive: true });
const core = readFileSync(here('src/core.js'), 'utf8').replace(/^export /gm, '');
const shim = readFileSync(here('src/browser.js'), 'utf8');
const json = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
writeFileSync(here('dist/mock-api.js'), `// Generated by mock/build.mjs: do not edit. See mock/README.md.\n(() => {\n${core}\nconst FIXTURES = ${json(fixtures)};\nconst LEXICONS = ${json(lexicons)};\n${shim}\n})();\n`);
const count = (col) => Object.values(repos).reduce((s, r) => s + Object.keys(r.records[col] || {}).length, 0);
console.log(`${n} records valid in ${Object.keys(repos).length} repos:`, Object.fromEntries(Object.values(C).map((c) => [c.replace(NS + '.', ''), count(c)])), dropped ? `(${dropped} whisper dropped)` : '', cut ? `(${cut} long texts cut to 100,000 graphemes)` : '');
