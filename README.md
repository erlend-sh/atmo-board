# atmo-board

An atmospheric comms application: Discourse on atproto, a little more minimal, with Discord's channels. One install is one forum, and each forum is an [Atmospheric Group](https://tangled.org/opensocial.group/proposal).

- **Threads all the way down.** A channel is a thread with a sidebar entry. Its own posts are the channel's untitled chat, and its child threads are the named threads.
- **Discourse URLs.** `/t/{key}/{slug}/{n}` points at post *n*, a channel is `/c/{key}/{slug}` and its chat `/c/{key}/{slug}/chat`, `/p/{key}` is a permalink, and stale slugs redirect. A key is 10 base32 characters of the sha256 of the record's at-uri.
- **Slow realtime.** Pages are server-rendered, and an open tab polls for change hints every 15 seconds.

The stack follows [atmoBB](https://github.com/keithk/atmoBB): SvelteKit (Svelte 5, adapter-node) for the web app, and [HappyView](https://github.com/gamesgamesgamesgamesgames/happyview) as the appview. The whole API is HappyView XRPC (`dev.atmoboard.*`), written in Lua, and forum content lives in HappyView's permissioned spaces.

## Run the local demo

You need Docker (with Compose), [bun](https://bun.sh), Node 22.19 or newer, `curl`, `jq` and `openssl`. No PDS or atproto account is needed: the demo signs you in as a seeded member.

```sh
bun install
sh appview/demo.sh   # starts Postgres and HappyView, configures them, seeds a demo forum
bun run dev          # http://127.0.0.1:5173
```

`appview/demo.sh` writes `.env` with fresh secrets, creates a HappyView operator key and API client, installs the lexicons, Lua endpoints and derived tables, and seeds a forum with four channels and some conversation. It's safe to rerun.

On the sign-in page you can be **Alice** (admin), **Maya** (moderator), **Bob** or **Sam**, or arrive as a newcomer and join the forum. Open a second browser profile as someone else to watch posts arrive by polling.

To start over, run `docker compose down -v` and then `sh appview/demo.sh` again.

## Layout

| Path | What |
|---|---|
| `lexicons/` | `dev.atmoboard.*` records, queries and procedures, plus a vendored subset of the `group.opensocial.*` drafts |
| `appview/lua/` | One Lua script per XRPC method. `_lib.lua` is prepended to each by `setup.sh` |
| `appview/schema.sql` | Derived tables: items and keys, channels, read state, the change log |
| `appview/setup.sh` | Idempotent HappyView configuration; run after every deploy |
| `appview/demo.sh`, `seed-dev.mjs` | The local demo |
| `src/` | The SvelteKit web app |

## Status

Milestone 1 (skeleton): channels, chat, threads, replies, unread counts, polling, permalinks and the dev sign-in. Next: atproto OAuth sign-in through HappyView, reactions, edit history and search, then trust levels and moderation, then a Railway deployment.

`dev.atmoboard` is a placeholder namespace.
