// node --test test.mjs  (run node build.mjs first)
// Checks the mock's answers against the lexicons' output schemas and the README's indexing rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Lexicons } from '@atproto/lexicon';
import { createMockApi, NS, parseUri } from './src/core.js';

const here = (p) => new URL(p, import.meta.url);
const fixtures = JSON.parse(readFileSync(here('fixtures.json')));
const lexicons = readdirSync(here('lexicons/'), { recursive: true }).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, here('lexicons/')))));
const lex = new Lexicons(lexicons);
const fresh = () => createMockApi({ fixtures, lexicons });
async function q(api, nsid, params) {
  const out = await api.call(nsid, params);
  if (nsid.startsWith(NS)) {
    lex.assertValidXrpcParams(nsid, params);
    lex.assertValidXrpcOutput(nsid, out);
  }
  return out;
}
const T = (n) => `${NS}.${n}`;

test('getGroup lists channels by section and position, with counts', async () => {
  const api = fresh();
  const g = await q(api, T('getGroup'), { group: api.group });
  assert.equal(g.record.name, 'Atmosphere Community');
  assert.equal(g.channels.length, 19);
  assert.deepEqual(g.channels.slice(0, 2).map((c) => c.thread.record.title), ['Discussion', 'Share your project']);
  assert.ok(g.memberCount > 80);
  const disc = g.channels.find((c) => c.thread.record.title === 'Discussion');
  assert.ok(disc.threadCount > 5);
  assert.equal(disc.thread.postCount, 4, 'the spam chat message is hidden');
  const ietf = g.channels.find((c) => c.thread.record.title === 'ATP IETF Mailing List');
  assert.equal(ietf.thread.state.locked, true);
});

test('listThreads: latest first, pinned first under a parent, opening post and excerpt', async () => {
  const api = fresh();
  const g = await q(api, T('getGroup'), { group: api.group });
  const lc = g.channels.find((c) => c.thread.record.title === 'Lexicon Community').thread.uri;
  const { threads } = await q(api, T('listThreads'), { parent: lc });
  assert.equal(threads[0].record.title, 'Community App Lexicon WG');
  assert.ok(threads[0].state.pinnedUntil);
  const rest = threads.slice(1).map((t) => t.lastPostAt);
  assert.deepEqual(rest, [...rest].sort().reverse());
  for (const t of threads) {
    assert.ok(t.opening, 'every sample thread has an OP');
    assert.ok(t.excerpt.length <= 300);
    assert.ok(t.posters.length <= 5 && t.posters[0] === t.author);
  }
  const all = await q(api, T('listThreads'), { group: api.group, limit: 100 });
  assert.equal(all.threads.length, 32);
  assert.ok(all.threads.every((t) => t.record.parent), 'channels are left out of the group listing');
  const top = await q(api, T('listThreads'), { group: api.group, sort: 'top', limit: 3 });
  assert.ok(top.threads[0].score >= top.threads[1].score);
  assert.ok(top.cursor);
});

test('getThread returns posts oldest first with tallies, and chat newest first', async () => {
  const api = fresh();
  const { threads } = await q(api, T('listThreads'), { group: api.group, limit: 100 });
  const big = threads.find((t) => t.record.title === 'A community app lexicon');
  const r = await q(api, T('getThread'), { thread: big.uri, limit: 100 });
  assert.equal(r.thread.postCount, 67);
  assert.equal(r.posts.length, 67);
  assert.equal(r.posts[0].uri, r.thread.opening);
  assert.ok(r.posts.some((p) => p.reactions?.[0].emoji === '❤️'));
  assert.ok(r.posts.some((p) => p.replyCount > 0));
  const g = await q(api, T('getGroup'), { group: api.group });
  const disc = g.channels.find((c) => c.thread.record.title === 'Discussion').thread.uri;
  const chat = await q(api, T('getThread'), { thread: disc, order: 'newest', limit: 2 });
  assert.equal(chat.posts[0].record.textContent, 'welcome carol!');
  assert.equal(chat.thread.opening, undefined, 'a channel has no OP');
});

test('staff see hidden posts, with their state', async () => {
  const api = fresh();
  const g = await q(api, T('getGroup'), { group: api.group });
  const disc = g.channels.find((c) => c.thread.record.title === 'Discussion').thread.uri;
  api.signIn('maya.example');
  const r = await q(api, T('getThread'), { thread: disc });
  const spam = r.posts.find((p) => p.state?.hidden);
  assert.ok(spam && /Grow your followers/.test(spam.record.textContent));
});

test('writes: start a thread with its OP in one applyWrites, reply, react, vote, and see the views change', async () => {
  const api = fresh();
  const g = await q(api, T('getGroup'), { group: api.group });
  const parent = g.channels.find((c) => c.thread.record.title === 'Discussion').thread.uri;
  const bob = api.signIn('bob.example');
  const rkey = api.tid(), now = new Date().toISOString();
  const uri = `at://${bob}/${T('thread')}/${rkey}`;
  const { results } = await api.call('com.atproto.repo.applyWrites', {}, {
    repo: bob, writes: [
      { $type: 'com.atproto.repo.applyWrites#create', collection: T('thread'), rkey, value: { $type: T('thread'), group: api.group, parent, title: 'Hello from the mock', publishedAt: now } },
      { $type: 'com.atproto.repo.applyWrites#create', collection: T('post'), value: { $type: T('post'), thread: uri, textContent: 'First!', createdAt: now } },
    ],
  });
  assert.equal(results[0].uri, uri);
  let { threads } = await q(api, T('listThreads'), { parent });
  assert.equal(threads[0].uri, uri, 'newest activity first');
  assert.equal(threads[0].opening, results[1].uri);
  assert.equal(threads[0].excerpt, 'First!');

  api.signIn('maya.example');
  const maya = api.viewer;
  const reply = await api.call('com.atproto.repo.createRecord', {}, { repo: maya, collection: T('post'), record: { $type: T('post'), thread: uri, replyTo: results[1].uri, textContent: 'Welcome', createdAt: new Date().toISOString() } });
  await api.call('com.atproto.repo.createRecord', {}, { repo: maya, collection: T('reaction'), record: { $type: T('reaction'), subject: results[1].uri, emoji: '🎉', createdAt: new Date().toISOString() } });
  const vote = await api.call('com.atproto.repo.createRecord', {}, { repo: maya, collection: T('recommend'), record: { $type: T('recommend'), subject: uri, createdAt: new Date().toISOString() } });
  let r = await q(api, T('getThread'), { thread: uri });
  assert.equal(r.thread.postCount, 2);
  assert.equal(r.thread.score, 1);
  assert.deepEqual(r.thread.viewer, { recommend: vote.uri, direction: 'up', notify: 'threads' });
  assert.deepEqual(r.posts[0].reactions, [{ emoji: '🎉', count: 1 }]);
  assert.equal(r.posts[0].replyCount, 1);
  assert.equal(r.posts[0].viewer.reactions[0].emoji, '🎉');
  assert.equal(r.posts[1].uri, reply.uri);

  // changing a vote updates the record in place
  await api.call('com.atproto.repo.putRecord', {}, { repo: maya, collection: T('recommend'), rkey: parseUri(vote.uri).rkey, record: { $type: T('recommend'), subject: uri, direction: 'down', createdAt: new Date().toISOString() } });
  r = await q(api, T('getThread'), { thread: uri });
  assert.equal(r.thread.score, -1);

  // staff write overrides into the group's repo
  await api.call('com.atproto.repo.createRecord', {}, { repo: parseUri(api.group).repo, collection: T('override'), record: { $type: T('override'), subject: uri, action: 'rename', title: 'Renamed by staff', actor: maya, createdAt: new Date().toISOString() } });
  r = await q(api, T('getThread'), { thread: uri });
  assert.equal(r.thread.title, 'Renamed by staff');
});

test('writes are checked: lexicon, auth, locks', async () => {
  const api = fresh();
  const g = await q(api, T('getGroup'), { group: api.group });
  const ietf = g.channels.find((c) => c.thread.record.title === 'ATP IETF Mailing List').thread.uri;
  const post = (thread, extra = {}) => ({ $type: T('post'), thread, textContent: 'hi', createdAt: new Date().toISOString(), ...extra });
  await assert.rejects(api.call('com.atproto.repo.createRecord', {}, { repo: 'bob.example', collection: T('post'), record: post(ietf) }), { error: 'AuthRequired' });
  const bob = api.signIn('bob.example');
  await assert.rejects(api.call('com.atproto.repo.createRecord', {}, { repo: bob, collection: T('post'), record: post(ietf) }), { error: 'Locked' });
  await assert.rejects(api.call('com.atproto.repo.createRecord', {}, { repo: bob, collection: T('post'), record: { $type: T('post'), thread: ietf, createdAt: 'yesterday' } }), { error: 'InvalidRecord' });
  await assert.rejects(api.call('com.atproto.repo.createRecord', {}, { repo: 'maya.example', collection: T('post'), record: post(ietf) }), { error: 'Forbidden' });
  // a failed applyWrites leaves nothing behind
  const before = JSON.stringify(api.dump());
  await assert.rejects(api.call('com.atproto.repo.applyWrites', {}, { repo: bob, writes: [
    { $type: 'com.atproto.repo.applyWrites#create', collection: T('reaction'), value: { $type: T('reaction'), subject: ietf, emoji: '👍', createdAt: new Date().toISOString() } },
    { $type: 'com.atproto.repo.applyWrites#create', collection: T('post'), value: post(ietf) },
  ] }), { error: 'Locked' });
  assert.equal(JSON.stringify(api.dump()), before);
});

test('subscriptions: joined, and the most specific one wins', async () => {
  const api = fresh();
  api.signIn('bob.example');
  const g = await q(api, T('getGroup'), { group: api.group });
  assert.ok(g.viewer.subscription);
  const events = g.channels.find((c) => c.thread.record.title === 'Event Planning').thread;
  assert.equal(events.viewer.notify, 'none');
  const { threads } = await q(api, T('listThreads'), { parent: events.uri });
  assert.ok(threads.every((t) => t.viewer.notify === 'none' && !t.viewer.subscription), 'inherited from the channel');
  api.signIn('carol.example');
  const g2 = await q(api, T('getGroup'), { group: api.group });
  assert.equal(g2.viewer.subscription, undefined, 'the newcomer has not joined');
});

test('handle() speaks XRPC over URLs', async () => {
  const api = fresh();
  const ok = await api.handle('GET', `/xrpc/${T('getGroup')}?group=${encodeURIComponent(api.group)}`);
  assert.equal(ok.status, 200);
  const bad = await api.handle('GET', `/xrpc/${T('getThread')}?thread=nope`);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'InvalidRequest');
  const missing = await api.handle('GET', '/xrpc/app.example.nothing');
  assert.equal(missing.status, 501);
  const prof = await api.handle('GET', '/xrpc/app.bsky.actor.getProfiles?actors=bob.example&actors=bmann.ca');
  assert.deepEqual(prof.body.profiles.map((p) => p.handle), ['bob.example', 'bmann.ca']);
});
