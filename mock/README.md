# Mock API

A stand-in for the read API a frontend-only atmo-board page will call: a Group Host or appview serving `garden.msg.*` (draft 9) from a group's public space. Everything runs in the page, from one script, with no backend.

```html
<script src="mock/dist/mock-api.js" data-as="bob.example"></script>
<script>
  const res = await fetch(`https://mock.invalid/xrpc/garden.msg.listThreads?parent=${encodeURIComponent(uri)}`)
</script>
```

The script answers `fetch()` calls to `/xrpc/*` (same origin) or `https://mock.invalid/xrpc/*`, so the page is written against plain XRPC. Swapping in a real host means dropping the script tag and changing the base URL. Open [`index.html`](index.html) for a small working example: board, thread, chat, replies, reactions, votes, and a "viewing as" switch.

## What's in it

| Path | What |
|---|---|
| `fixtures.json` | 1,439 plain records grouped by the repo that writes them: the group, 19 channels, 32 threads with 375 posts, reactions, recommends, subscriptions, overrides and profiles. Generated, don't edit. |
| `lexicons/` | Copied from the Atmospheric Threads proposal (draft 9): records, view defs and the four queries below. `vendor/` has a trimmed `app.bsky.actor.profile`. |
| `src/core.js` | The mock indexer. No dependencies; runs in the page and in Node. |
| `src/browser.js` | The fetch shim and `window.mockApi`. |
| `dist/mock-api.js` | `core.js` + `browser.js` with the fixtures and lexicons inlined, so it works from `file://`. Generated. |
| `build.mjs` | Makes `fixtures.json` from `sample-data/data.json` (the preview's Discourse sample), validates every record with `@atproto/lexicon`, and writes the bundle. |
| `test.mjs` | Checks each query's output against its lexicon schema, plus the README's indexing rules. |

```sh
cd mock && npm install
npm run build   # fixtures + bundle
npm test
```

## Queries (proposed names)

These queries are part of the shared lexicon as of draft 9. Their lexicons are in `lexicons/` and return the shared `defs#threadView` and `defs#postView`.

| Method | Params | Returns |
|---|---|---|
| `garden.msg.getGroup` | `group` | The group record, its channels in section and position order (each with its `threadView` and `threadCount`), `memberCount`, `staff`, and the viewer's membership. The sidebar. |
| `garden.msg.listThreads` | `parent` or `group`, `sort` (`latest`, `new`, `top`), `tag`, `limit`, `cursor` | `threadView`s. Under a `parent`, pinned threads come first. With `group` alone, every thread that isn't a channel: the Latest page. |
| `garden.msg.getThread` | `thread`, `order` (`oldest`, `newest`), `limit`, `cursor` | The `threadView` and its `postView`s: the opening post and replies, or a channel's chat (`order=newest` to page back from the bottom). Also takes a `site.standard.document`, for article comments. |
| `garden.msg.listReactions` | `subject`, `emoji` | Who reacted with what, for a tooltip. |

The mock also answers the few standard methods a client needs: `app.bsky.actor.getProfile(s)` (display names and handles), `com.atproto.identity.resolveHandle`, `com.atproto.server.getSession`, and `com.atproto.repo.getRecord`, `listRecords`, `createRecord`, `putRecord`, `deleteRecord` and `applyWrites`.

## How it indexes

It does what the Atmospheric Threads README asks of an indexer, computed on every read:

- **Overrides** count only when written by the repo that owns the subject's group, and the newest per subject and action wins. `until` lapses. Hidden threads and posts drop out unless the viewer is staff, who see them with `state.hidden`.
- **Opening post**: the thread author's first post in it with no `replyTo`. **Excerpt**: the description, or the OP's first 300 graphemes and 3 paragraphs.
- **Counts**: `postCount` and `replyCount` skip hidden posts. `posters` is the OP's author, then the most recent posters, up to 5. `lastPostAt` is the newest post.
- **Votes**: one per person per subject, the newest counts, `down` subtracts. **Reactions**: one per person per emoji.
- **Subscriptions**: the most specific one wins, so a thread inherits `notify` from its channel and then the group.

## Writes

Writes go through `com.atproto.repo.*` into the signed-in viewer's repo and only change memory, so a reload starts over. Staff can also write to the group's repo (overrides, channels). Every write is checked against the lexicons. Posting in a locked thread, or starting a thread under a locked channel, is refused unless you're staff. On the real network nobody can stop a write to your own repo, so the indexer would ignore it instead; the mock refuses it so the UI can show why.

After each write the page gets a `mockapi:change` event, the way a real page would get a change hint from polling.

## Viewing as

`mockApi.signIn('bob.example')` (or `data-as` on the script tag, or `?mockAs=` in the URL) picks the viewer, and `mockApi.signOut()` browses as a visitor. The sample accounts from the design preview are here:

- `maya.example`: moderator (staff), along with the two Discourse admins.
- `bob.example`: a member who follows one thread and quietly follows Event Planning.
- `carol.example`: a newcomer who hasn't joined.
- `spam.example`: whose chat message is hidden.

Any of the 84 Discourse accounts works too, by handle.

## The sample data

The threads are real, from discourse.atmosphere.community (fetched 2026-10-24), as shortened in the design preview. Some things are made up or derived:

- Discourse likes become ❤️ reactions from members picked at random. The opening post's likers also recommend the thread, since Discourse has no topic votes.
- The Discussion chat, the hidden spam message, the pinned thread, the locked IETF channel, one down vote and the sample accounts come from the preview, not Discourse.
- Dates are shifted so the sample's "now" (2026-10-24 11:00 UTC) is the real now. `data-shift-time="false"` keeps them.
- Left out: the one whisper, and the private Regulars and Staff channels, because they'd live in private spaces.

## Not modelled

Private spaces and space-qualified URIs (open questions 1 and 2), read state and unread counts (private, so the page keeps them), search, notifications, blobs and group icons, and trust levels.
