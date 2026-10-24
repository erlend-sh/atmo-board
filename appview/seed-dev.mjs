// Seed a demo forum: the group, a few members, channels, threads and chat.
// Reads .env; run it through appview/demo.sh, or `bun run seed` once
// HappyView is configured. Skips if the forum already has channels, unless
// called with --force (which adds a second copy of the content).
import { client } from './hv.mjs';

process.loadEnvFile?.('.env');
const env = process.env;
const hv = client({
  url: env.HAPPYVIEW_URL ?? 'http://127.0.0.1:3000',
  secret: env.HAPPYVIEW_SESSION_SECRET,
  clientKey: env.HAPPYVIEW_CLIENT_KEY,
  clientSecret: env.HAPPYVIEW_CLIENT_SECRET,
});
const NS = 'dev.atmoboard';
const FORUM = env.ATMOBOARD_FORUM_DID ?? 'did:plc:atmoboardforum0000000000';
const md = (text) => ({ textContent: text, content: { $type: `${NS}.defs#markdown`, text } });

const people = {
  alice: { did: 'did:plc:alice0000000000000000000', handle: 'alice.test', displayName: 'Alice', roles: ['admin'] },
  maya: { did: 'did:plc:maya00000000000000000000', handle: 'maya.test', displayName: 'Maya', roles: ['moderator'] },
  bob: { did: 'did:plc:bob00000000000000000000000', handle: 'bob.test', displayName: 'Bob' },
  sam: { did: 'did:plc:sam00000000000000000000000', handle: 'sam.test', displayName: 'Sam' },
};

const sidebar = await hv.query(`${NS}.getSidebar`).catch(() => null);
if (sidebar?.sections.some((s) => s.channels.length) && !process.argv.includes('--force')) {
  console.log('The forum already has channels; nothing to seed. Pass --force to add more.');
  process.exit(0);
}

const as = (p) => p.did;
const procedure = (name, body, who) => hv.procedure(`${NS}.${name}`, body, who);

await procedure('admin.initForum', {
  name: 'Atmo Board',
  description: 'A demo forum on atproto: Discourse-style threads with Discord-style channels.',
  joinPolicy: 'open', admin: people.alice.did, adminHandle: people.alice.handle,
}, FORUM);
for (const p of Object.values(people)) {
  await procedure('admin.addMember', {
    member: p.did, roles: p.roles ?? ['member'], actor: people.alice.did, handle: p.handle, displayName: p.displayName,
  }, FORUM);
}

const channel = (title, icon, section, position, description) =>
  procedure('admin.putChannel', { actor: people.alice.did, title, icon, section, position, description }, FORUM);
const general = await channel('general', '💬', 'Community', 0, 'Talk about anything');
const intros = await channel('introductions', '👋', 'Community', 1, 'Say hi and tell us what brought you here');
const ideas = await channel('ideas', '💡', 'atmo-board', 0, 'Feature ideas and feedback');
const help = await channel('help', '❓', 'atmo-board', 1, 'Stuck on something? Ask here');

const chat = (ch, who, text) => procedure('createPost', { thread: ch.key, ...md(text) }, as(who));
const thread = (ch, who, title, text) => procedure('createThread', { parent: ch.key, title, ...md(text) }, as(who));
const reply = (t, who, text, replyTo) => procedure('createPost', { thread: t.key, replyTo, ...md(text) }, as(who));

await chat(general, people.alice, 'Welcome, everyone! This is the untitled chat of **#general**. Named threads live in the Threads tab.');
await chat(general, people.bob, 'hey all 👋');
await chat(general, people.bob, 'so chat and threads are the same thing underneath?');
await chat(general, people.maya, 'Yep. A channel is just a thread with a sidebar entry. Its own posts are this chat, and its child threads are the topics.');
await chat(general, people.sam, 'neat, and everything polls every 15 seconds, so new messages show up without a reload');

const welcome = await thread(general, people.alice, 'Welcome to atmo-board',
  'atmo-board is a forum on atproto, shaped like Discourse with a little Discord.\n\n' +
  '- Every channel has an untitled **chat** and a list of **threads**.\n' +
  '- Links look like Discourse\'s: `/t/{key}/{slug}/{n}` points at post *n*.\n' +
  '- Your posts are written to the forum\'s space under your own DID.\n\nTry replying below.');
const r2 = await reply(welcome, people.bob, 'Love that post numbers work like Discourse. `/t/…/welcome-to-atmo-board/2` is this post.');
await reply(welcome, people.sam, 'Is there a short link for a single post?');
await reply(welcome, people.maya, 'Yes, `/p/{key}` (click the timestamp on any post). It keeps working if the post is moved.', r2.key);

const hi = await thread(intros, people.sam, 'Hi, I\'m Sam', 'I run a small book club and want a forum that our members own. atproto seemed like the right fit.');
await reply(hi, people.alice, 'Welcome Sam! A book club is exactly the kind of group we have in mind.');
await chat(intros, people.bob, 'Bob here, mostly lurking for now.');

const dark = await thread(ideas, people.bob, 'Reactions on chat messages', 'Could we get emoji reactions on chat messages, like Discord? A ❤️ could double as the Discourse-style like.');
await reply(dark, people.maya, 'Done: hover any message and pick an emoji. Edit history came along with it.');
await thread(ideas, people.sam, 'Trust levels for new members', 'Will new members be sandboxed the way Discourse does it with TL0?');

const login = await thread(help, people.sam, 'How do I sign in with Bluesky?', 'I only see a member picker on the sign-in page.');
await reply(login, people.alice, 'That\'s the local demo login. With OAuth configured, the sign-in page takes your handle and sends you to your PDS.');

console.log(`Seeded "Atmo Board": ${Object.keys(people).length} members, 4 channels.`);
console.log('Members you can sign in as:', Object.values(people).map((p) => p.handle).join(', '));
