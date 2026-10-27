# URL design

atmo-board follows Discourse's URL design, with one change: the identity of a page is a short key derived from the record's atproto address, and the slug after it is only decoration.

This combines items 2 and 6 of `atmo-board-requirements.md` in the project notes.

## Why not atmoBB's URLs (item 2)

[atmoBB's URLs are brittle](https://atmobb.app/t/atmobb-discussion/url-structure/did:plc:6cbrxnrfmwpb7rhjkihqezzh/3mvj3z46huj2c#post-3mxbfplkkuh2v). A thread URL there looks like

```
/t/atmobb-discussion/url-structure/did:plc:6cbrxnrfmwpb7rhjkihqezzh/3mvj3z46huj2c
```

It spells out the board, the slug, the author's DID and the record key. That makes links long and hard to read, and every part is something that can change or that a reader doesn't need. Discourse's URLs (`/t/{slug}/{id}`, `/c/{slug}/{id}`) are short and readable, and they keep working after a rename because the ID, not the slug, identifies the page.

## Keys (item 6)

Every thread, channel and post gets a **key** of 10 characters:

1. Take the record's full at-uri, for example `at://did:plc:…/dev.atmoboard.thread/3mvj3z46huj2c`.
2. Hash it with SHA-256.
3. Write the first 50 bits as 10 lowercase base32 characters (RFC 4648 alphabet `a–z2–7`).

Properties:

- **Any appview can compute it.** It needs nothing but the at-uri, so no server hands out IDs.
- **It survives PDS migrations and handle changes**, because the at-uri is built from the author's DID, which doesn't change.
- **Collisions are negligible at forum scale.** 50 bits gives about a one-in-a-million chance of any collision among 50,000 records.

The appview computes keys in `appview/lua/_lib.lua` (`key_for`), and the web app accepts only keys of that shape (`src/params/key.ts`).

**Not handled yet:** a collision. The requirements say an appview that finds one can resolve it from its index. Today the second record is silently skipped at indexing time.

## Routes

**Decided (Erlend, 2026-10-23): key first, slug after.** That is the reverse of Discourse, so chat links read `…/general/chat`.

| URL | Page |
|---|---|
| `/c/{key}/{slug}` | A channel's named threads, with its chat row at the top |
| `/c/{key}/{slug}/chat` | The channel's untitled chat |
| `/t/{key}/{slug}` | A thread, opened at the first unread post when signed in |
| `/t/{key}/{slug}/{n}` | A thread at post number `n` |
| `/t/{key}/{slug}/last` | A thread at its last post |
| `/p/{key}` | A post permalink |
| `/u/{handle or DID}` | A member |
| `/search?q=` | Search |

How they behave:

- **The slug is decorative and optional.** `/t/{key}/{n}` works, and a missing or stale slug gets a 301 to the canonical URL, so links keep working after a rename.
- **A channel's thread URL redirects.** `/t/{key}` for a channel goes to its `/c/` URL.
- **Post permalinks survive moves.** `/p/{key}` looks up wherever the post lives now and redirects there, so a link to a post still works after its thread is moved or renamed. Posts in a channel's chat land on the chat page.
- **Post numbers count up within each thread**, starting at 1 for the opening post.
