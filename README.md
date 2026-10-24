# atmo-board

An atmospheric comms application: Discourse on atproto, a little more minimal, with Discord's channels. One install is one forum, and each forum is an [Atmospheric Group](https://tangled.org/opensocial.group/proposal).

- **Threads all the way down.** A channel is a thread with a sidebar entry. Its own posts are the channel's untitled chat, and its child threads are the named threads.
- **Discourse URLs.** `/t/{key}/{slug}/{n}` points at post *n*, a channel is `/c/{key}/{slug}` and its chat `/c/{key}/{slug}/chat`, `/p/{key}` is a permalink, and stale slugs redirect. A key is 10 base32 characters of the sha256 of the record's at-uri.
- **Slow realtime.** Pages are server-rendered, and an open tab polls for change hints every 15 seconds.

The stack follows [atmoBB](https://github.com/keithk/atmoBB): SvelteKit (Svelte 5, adapter-node) for the web app, and [HappyView](https://github.com/gamesgamesgamesgamesgames/happyview) as the appview. The whole API is HappyView XRPC (`dev.atmoboard.*`), written in Lua, and forum content lives in HappyView's permissioned spaces.

## Run the local demo

You need Docker (with Compose), [bun](https://bun.sh), Node 22.19 or newer, `curl`, `jq` and `openssl`. No PDS or atproto account is needed: the demo lets you sign in as a seeded member.

```sh
bun install
sh appview/demo.sh   # starts Postgres and HappyView, configures them, seeds a demo forum
bun run dev          # http://127.0.0.1:5173
```

`appview/demo.sh` writes `.env` with fresh secrets, creates a HappyView operator key and API client, installs the lexicons, Lua endpoints and derived tables, and seeds a forum with five channels (one of them private) and some conversation, including a whisper and a flag waiting in the review queue. It's safe to rerun.

On the sign-in page you can be **Alice** (admin), **Maya** (moderator), **Bob** or **Sam**, or arrive as a newcomer and join the forum. Open a second browser profile as someone else to watch posts arrive by polling.

The same page also takes a real atproto handle. Sign-in is OAuth through HappyView's SDK, asking only for the bare `atproto` scope: it proves who you are, and your posts are written through the forum's space rather than to your PDS. Locally it uses atproto's loopback client, so it works from `http://127.0.0.1:5173` with no hosted metadata. In production, set `ATMOBOARD_APP_URL` to the https URL (its `/oauth-client-metadata.json` becomes the client_id, and the HappyView API client must be registered with it) and give `DATA_DIR` a persistent volume.

To start over, run `docker compose down -v` and then `sh appview/demo.sh` again.

## Layout

| Path | What |
|---|---|
| `lexicons/` | `dev.atmoboard.*` records, queries and procedures, plus a vendored subset of the `group.opensocial.*` drafts. Generated: edit `scripts/lexicons.py` and rerun it |
| `appview/lua/` | One Lua script per XRPC method. `_lib.lua` is prepended to each by `setup.sh` |
| `appview/schema.sql` | Derived tables: items and keys, channels, read state, revisions, reports, trust inputs, the change log |
| `appview/setup.sh` | Idempotent HappyView configuration; run after every deploy |
| `appview/demo.sh`, `seed-dev.mjs` | The local demo |
| `src/` | The SvelteKit web app |
| `infra/`, `Dockerfile`, `.railway/` | The release stack: Compose bundle, app image, Caddy edge, Railway IaC |
| `src/lib/server/oauth/` | atproto OAuth through `@happyview/oauth-client-node`, ported from atmoBB |

## Status

- Milestone 1: channels, chat, threads, replies, unread counts, polling, permalinks and the demo sign-in.
- Milestone 2: reactions, edits with history, author deletes, search (`/search`, narrowable by member or thread), watching and muting threads and channels, and atproto OAuth sign-in.
- Milestone 3: trust levels, moderation, and private spaces (below).

Milestone 4 is the deployment: see [docs/deploy.md](docs/deploy.md) for Railway or self-hosted Compose.

The interface takes Skyreader's look. Besides Index and the channels, the sidebar has pages that gather channels: **Working groups** and **Projects** (cards, plus one board of all their threads) and **Events** (upcoming events, then the event channels as tabs). Which sections and channels they gather, and which channels are pinned under MAIN, is set in `src/lib/directories.ts`.

## Moderation, trust levels and private channels

Trust levels are Discourse's, and in the group model they're **roles**: the appview computes TL0 to TL3 from private signals (posts read, topics entered, days visited, likes given and received) and publishes the result as a `tl0`–`tl4` role on the member's `group.opensocial.membership`. TL4 is granted by staff, and any level staff set by hand is locked until they unlock it. A new member (TL0) is sandboxed: at most two links in a post. TL1 can flag, TL3 can rename and move threads, TL4 can also pin, lock and hide.

Every staff decision is a **forum-signed `dev.atmoboard.override`** record naming the staff member, applied on top of the authors' own records: move, rename, hide, unhide, lock, unlock, pin, unpin, `setTrustLevel` and `ban`. Authors' records are never changed by anyone else.

**Flags** (`report`) are private appview state, like the opensocial proposal's moderation queue. Three open flags hide a post until staff settle it at `/review`; disagreeing there lifts a hide the flags caused.

**Whispers** are staff-only posts in an ordinary thread: the record goes to the forum's `staff` space, and the post takes a number that non-staff never see (`last_public` is how far members can count). **Private channels** work the same way: each one is a channel whose subtree lives in its own space, with an access list of roles. A channel's privacy is fixed when it's created, because its records live in that space.

`dev.atmoboard` is a placeholder namespace.
