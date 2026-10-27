# atmo-board: requirements so far

atmo-board is "Discourse on atproto", a little more minimal and with Discord's look. atmoBB (https://github.com/keithk/atmoBB) is the primary reference.

## From Erlend
1. **Copy atmoBB's stack.** That means SvelteKit (adapter-node, Svelte 5) for the app, and HappyView for the appview. HappyView is a Rust and Postgres engine that ingests Jetstream and serves XRPC queries written in Lua. Postgres also holds derived tables, and login uses HappyView's OAuth SDK plus its PDS service proxy.
2. **Adopt Discourse's URL design.** [atmoBB's URLs are brittle](https://atmobb.app/t/atmobb-discussion/url-structure/did:plc:6cbrxnrfmwpb7rhjkihqezzh/3mvj3z46huj2c#post-3mxbfplkkuh2v).
3. **Combine Discourse's UX with Discord's, not atmoBB's phpBB style.**
   - **From Discourse:** a web-first forum where threads come first. There's no vertical server rail like Discord's, because one site is one community.
   - **From Discord:** categories show up as `#channels` with a hash icon, and buttons are kept to a minimum.
4. **Let Discourse's Trust Levels lead the moderation design.**
5. **Use Discourse-style permissions to start.** Each category grants each group one of three levels: See, Reply or Create. The groups include the automatic trust-level groups and staff.
6. **Derive the URL key from the atproto address, in 10 characters or fewer.** The working idea is to hash the full at-uri, then write the first 50 bits as 10 lowercase base32 characters, giving `/t/{key}/{slug}`. **Decided (Erlend, 2026-10-23): key first, slug after** (`/t/{key}/{slug}/{n}`, `/c/{key}/{slug}`, `/c/{key}/{slug}/chat`), the reverse of Discourse, so chat links read `…/general/chat`. The slug stays decorative and optional. Any appview can compute this key, and it survives PDS migrations and handle changes, because the DID stays the same. Collisions are negligible at forum scale, and an appview that finds one can resolve it from its index.
7. **Give app users the most agency, as long as it doesn't complicate the architecture or the deployment.** The working answer is atmoBB's split:
   - **Member-owned records in the member's own repo:** joining (`membership`), posts and likes. Leaving means deleting the record, and all of it moves with the member to a new host.
   - **Forum-signed records in the forum account's repo:** channels, staff grants, manual trust-level grants and locks, per-channel group permissions, and moderation actions. They're public, so any appview can verify and honour them.
   - **Computed by the appview, not published:** automatic trust levels TL0 to TL3, because they depend on private read and visit data.
   - **Permissioned spaces only for private channels.**
   This adds no infrastructure beyond what atmoBB already runs.
   **Hosting:** Railway, not Cloudflare. See `deployment.md` (project notes).
8. **Design the API first, then derive the lexicons.** Start with atmo-board's own API and infer shared lexicons from it afterwards, rather than designing a generic cross-app API up front.
9. **Chat and forum share one threads container.** Treat Discourse Chat as an anti-pattern: it puts chat in a separate container with its own model. In atmo-board the whole discussion happens in one model, made of channels, threads and posts. "Chatty" and "forum-like" are ways of presenting and pacing the same thread, not different resource types. So there is one set of endpoints, one post record and one permission model. This also settles finding 2 in the apps README (`garden.msg.post` doesn't suit chat) in favour of a single post model.
10. **Use slow realtime, at the lowest cost and complexity.** The job to be done is web-first, with page loads as fast as atmoBB's or faster. Native apps will handle fast realtime later. The working answer is server-rendered pages plus hints and refetch. While a tab is visible, the client polls a cheap, cacheable query (for example `getChanges?since=<cursor>` for a thread or channel) every 10–30 seconds and refetches whatever changed. That means no WebSockets, no gateway and no per-user fan-out. A CDN or edge cache can absorb the polls. Server-Sent Events can come later if polling proves too slow. Seconds of delay from the firehose to Jetstream to the appview are acceptable at this pace.
11. **Edit history, soft delete and whispers are in scope.** How each might work on atproto (not designed yet):
    - **Edit history:** the appview keeps each version of a post (CID plus value) in a derived table when HappyView sees the update. History starts from when the appview first saw the post, so an edit made while the appview was offline isn't recorded.
    - **Soft delete:** a staff delete is a forum-signed `hide` action (atmoBB already has this). Staff can still see the post. An author's own delete removes the record from the network. **Decided for v1:** honour author deletes fully. The ideal is a staff-only copy, which is deferred.
    - **Whispers:** staff-only posts can't be public records, so they need a permissioned space shared by the staff group.

12. **Channels allow untitled chat**, like Zulip's "general chat". Under "threads all the way down", this is a default untitled thread that each channel has. Posts can go there without anyone opening a named thread first. Still open: whether a message in it can later be split out into a named thread. That would be the move or split action from item 13.
13. **Proposed from the Zulip cross-check, with no objection yet** (see `zulip-notes.md` in the project notes):
    - Moving posts between threads, as forum-signed override records.
    - Private per-user state in the appview: unread markers, follow/mute, drafts and bookmarks.
    - Snapshot plus change cursor for polling.
    - One filterable `listPosts` query.
    - Post permalinks that survive moves.
14. **DMs are out of scope.**
15. **Host on Railway, not Cloudflare,** so HappyView can run unmodified. The strategy is in `deployment.md` (project notes).

16. **By default, one install is one forum: a self-contained instance you host yourself.** We favour Discourse's self-host-friendly model over atmoBB's platform model. What follows:
    - **Not carried over from atmoBB:** the directory, the webring, cross-forum topic federation, hosted tenants, a shared appview serving many forums, delisting, and the extension directory.
    - **The appview is the forum's own.** It indexes only this forum's records: the forum account's repo, plus member records that point at this forum.
    - **The API is scoped to a single forum**, as Discourse's is. There's no forum DID parameter on every call, because the forum is implied by the host.
    - **Members still sign in with their atproto identity.** Their posts stay in their own repos, which is the portability we keep. Profile details specific to the forum are stored per forum.
    - **Distribution:** a Docker Compose bundle is the reference package, and a one-click Railway template is the default way to host it. See `deployment.md` (project notes).

17. **Each instance is an Atmospheric Group** (opensocial.group). The forum is a group DID, staff and trust levels are roles, and channels, private channels and whispers are spaces. See `atmospheric-group.md` (project notes) for the mapping, what changes, and the risks.
18. **A channel is a thread with a little more metadata.** "Threads all the way down" taken literally means there's one `thread` type with an optional `parent` thread.
    - A **channel** is a thread that the group features in the sidebar. The group writes a sidebar entry for it (position, icon, section), and that's the only difference. Promoting a thread to a channel means adding a sidebar entry, and demoting it means removing one.
    - **Untitled chat (item 12)** is the channel thread's own posts, and named threads are its child threads. So there is no separate untitled thread to create alongside each channel: the channel record is the chat.
    - **Moving** a thread means changing its parent, through a forum-signed override.
    - **Access:** a thread inherits its parent's space. A private channel is a channel thread whose subtree lives in its own space.
    - **Proposed depth limit:** two levels in the UI (channel, then thread), as in Discord, even though the model allows more.

Still open: Erlend's message said "for starters", so more points may follow.

---

## Prep: atmoBB's URLs today
- Board: `/b/[[did]]/[rkey]`, and thread in board: `/b/[[did]]/[rkey]/t/[authorDid]/[threadRkey]`
- Thread: `/t/[did]/[rkey]`, and post: `/t/[did]/[rkey]/p/[authorDid]/[postRkey]`
- Member: `/members/[actor]`

**Why this is brittle:**
- These URLs are raw record addresses. If a thread is moved, edited or re-keyed, or its author migrates to a new DID (rare), the link breaks.
- A post can only be addressed by its record key. Discourse addresses it by its position in the thread instead.
- The URLs don't contain a slug, so they tell a reader nothing.
- One thread can appear at two URLs.

## Prep: Discourse's URL scheme
| Resource | URL | Notes |
|---|---|---|
| Topic | `/t/{slug}/{id}` | `id` is the identity, and the slug is decorative. A wrong or stale slug redirects with a 301 to the canonical one, and `/t/{id}` works on its own. |
| Post in topic | `/t/{slug}/{id}/{post_number}` | `post_number` is the 1-based position in the topic. The page opens scrolled to that post. |
| Last post | `/t/{slug}/{id}/last` | |
| Short post link | `/p/{post_id}` | Redirects to the topic and post number, so it survives a post being moved. |
| Category | `/c/{parent-slug}/{slug}/{id}` | Slugs are decorative here too, and the ID alone resolves. |
| Category filters | `/c/{slug}/{id}/l/{latest\|new\|unread\|top}` | `/c/.../none` means "no subcategory". |
| Global lists | `/latest`, `/new`, `/unread`, `/top?period=weekly`, `/categories` | |
| Tag | `/tag/{tag}`, `/tags/c/{cat-slug}/{id}/{tag}` | |
| User | `/u/{username}`, `/u/{username}/activity`, `/u/{username}/summary` | |
| Group | `/g/{name}` | |
| Search | `/search?q=` | |
| JSON | Add `.json` to any of the above | The same URL serves the API. |

**The principles:**
- Each URL has one stable key, which is a number.
- The human-readable parts of a URL are decorative and get redirected.
- A post is addressed by its position in the thread.
- Every resource has a short permalink.
- The web URL and the API URL are the same.

**Decided:** see point 6 above. The key is a 10-character hash of the at-uri, and that's settled.

## Prep: Discourse trust levels (defaults, from memory of the docs; Discourse 3.x expresses most of these as group-based site settings)
| Level | How it's reached (defaults) | What it unlocks |
|---|---|---|
| TL0 New | Signing up | Sandboxed. Limited images, links and mentions, with new-user rate limits. Can't send PMs or flag. |
| TL1 Basic | Enter 5 topics, read 30 posts, spend 10 minutes reading | Normal posting (images, attachments, links), flagging, editing wiki posts, PMs |
| TL2 Member | Visit on 15 days, reply to 3 topics, enter 20 topics, read 100 posts, spend 60 minutes reading, give 1 like and receive 1 like | Invites, group PMs, more likes per day, eased rate limits |
| TL3 Regular | Measured over a rolling 100 days. Visit on 50% of days, reply to 10 topics, view 25% of topics, read 25% of posts, receive 20 likes and give 30. No suspensions, and few flags on your posts. **Demoted if the bar is no longer met.** | Recategorise topics and rename titles, access the Lounge category, links without nofollow, and stronger flags: flags from enough different TL3 users hide spam from TL0 users and silence them |
| TL4 Leader | **Granted manually** by staff | Edit any post, and pin, close, archive, unlist, split or merge topics. Flags hide posts immediately. |

Staff (moderators and admins) sit outside the ladder. Staff can lock any member's trust level up or down.

**Decided:** most of the moderation layer can live in the appview and be specific to atmo-board. Trust levels aren't defined at the protocol level yet. Instead, atmo-board's appview computes and stores them, using both private signals and public ones. Staff actions that must stay auditable can still be forum-signed records, such as bans, hides and manual grants.

**What changes on atproto:**
- **The inputs come from different places.** Likes, replies and topics created are public records, so any appview can count them. Read time, posts read and days visited are private telemetry. Only the forum's own appview can collect them, and only from members who are logged in. So TL1, TL2 and TL3 are local judgments made by that appview, not something a third party can verify. Trust levels could be computed only from public signals, or published as signed records.
- **Where the level lives. Decided, using my judgement:**
  - Automatic levels TL0 to TL3 live only in a derived appview table. They're recomputed on a schedule and never published. Publishing them would leak private read data, and the frequent changes (TL3 demotions, for instance) would churn the forum's repo.
  - Human decisions are forum-signed moderation action records, so they stay auditable. These are a manual grant (TL4, or any other level) and a lock, which pins a member's level in place. Both use a new `setTrustLevel` action with `level` and an optional `locked`.
  - The effective level is the most recent manual grant or lock if one exists, and otherwise the computed level.
  - Original options, kept for reference: a level could be computed in a derived table only, as atmoBB does with membership windows. Or it could also be published as a forum-signed record, such as a `trustLevel` grant, so other appviews can honour it. The manual TL4 grant and staff locks fit atmoBB's existing pattern: forum-signed moderator and action records.
- **Enforcement happens when content is read.** As in atmoBB, a TL0 user can still write a post with images to their own PDS. The appview decides what to serve, hide or hold for review. The editing powers of TL3 and TL4 (recategorise, rename, edit others' posts) can't change another person's record. They have to be forum-signed override records that the appview applies on top.

**Out of scope (Erlend, 2026-10-23):** solved/resolved threads, Discourse Solved-plugin style. That means no icon and no underlying state or override.
