# Research notes: Discord, Discourse, and the `garden.msg` baseline

Background for designing an atproto-grounded API for group chat and forum software. The research sections make no decisions. The last section lists the questions they raised and how each was answered for atmo-board (see [atmo-board-requirements.md](atmo-board-requirements.md)).

Sources: Discord developer docs (permissions page checked 2026-10-23), Discourse REST API docs (meta.discourse.org/t/22706) and the User API Keys spec (meta.discourse.org/t/48536), plus the atmospheric-threads project notes.

---

## 1. Discord

### Resource model
- **Guild** (server): owner, roles, emojis, stickers, soundboard, scheduled events, onboarding, welcome screen, AutoMod rules, audit log, verification level, default notification settings.
- **Channel**: a single object with a `type`. Types include GUILD_TEXT, GUILD_VOICE, GUILD_CATEGORY, GUILD_ANNOUNCEMENT, GUILD_STAGE_VOICE, GUILD_FORUM, GUILD_MEDIA, three thread types (PUBLIC_THREAD, PRIVATE_THREAD, ANNOUNCEMENT_THREAD), DM and GROUP_DM. Categories are channels too, and other channels point at one through `parent_id`. Each channel carries its own `position`, `topic`, `nsfw`, `rate_limit_per_user` (slowmode) and `permission_overwrites`.
- **Threads are channels.** A thread's `parent_id` is a text, announcement or forum channel. Threads have `thread_metadata` (`archived`, `auto_archive_duration`, `locked`, `invitable`, `archive_timestamp`) and a member list (`thread member`). Starting a thread from a message gives the thread the same ID as the message.
- **Forum and media channels** are containers that hold only threads. Each thread in one is a "post": a thread whose first message is the opening post. The forum channel defines `available_tags` (with an emoji and a `moderated` flag), `default_reaction_emoji`, `default_sort_order` and `default_forum_layout`. Threads carry `applied_tags`. This is the closest Discord comes to Discourse.
- **Message**: `content`, `author`, `embeds`, `attachments`, `components`, `reactions`, `mentions` (users, roles, channels, `@everyone`), `message_reference` (reply, forward or crosspost), `poll`, `sticker_items`, `flags` and `pinned`. Edits only update `edited_timestamp`, and no edit history is exposed.
- **Member**: a user inside a guild, with `nick`, `roles[]`, `joined_at`, `communication_disabled_until` (timeout), `pending` (membership screening) and per-guild avatar and banner.
- **Role**: `permissions` (a bitfield string), `position`, `color`, `hoist`, `mentionable`, `managed` (owned by an integration) and `flags`. `@everyone` is a role whose ID equals the guild ID.
- **Other**: Invite (code, expiry, max uses), Webhook (posts with an override name and avatar), Emoji, Sticker, Scheduled Event, Stage Instance, Integration, Application and interactions (slash commands and components), Entitlements/SKUs (monetisation).

### REST surface
REST is resource-oriented under `/api/v10`. The main groups are `/guilds/{id}` (with `/channels`, `/members`, `/roles`, `/bans`, `/audit-logs`, `/auto-moderation/rules`, `/threads/active`), `/channels/{id}` (with `/messages`, `/messages/{id}/reactions/{emoji}/@me`, `/permissions/{overwrite}`, `/threads`, `/thread-members`, `/pins`, `/invites`, `/typing`), `/users/@me` and `/webhooks/{id}/{token}`.
- Messages are paginated with `before`, `after` and `around` snowflake cursors. Snowflakes are time-sortable 64-bit IDs, comparable in spirit to atproto TIDs.
- Rate limits are per route and bucket (`X-RateLimit-*` headers), with a global limit on top.
- A moderator action can carry an `X-Audit-Log-Reason` header, which is recorded in the audit log.

### Permissions (the core design idea)
- A permission is a bit in a 64-bit field. There are about 52 flags today: VIEW_CHANNEL, SEND_MESSAGES, SEND_MESSAGES_IN_THREADS, CREATE_PUBLIC_THREADS, CREATE_PRIVATE_THREADS, MANAGE_THREADS, MANAGE_MESSAGES, PIN_MESSAGES (recently split out of MANAGE_MESSAGES), READ_MESSAGE_HISTORY, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, MENTION_EVERYONE, SEND_POLLS, BYPASS_SLOWMODE, KICK_MEMBERS, BAN_MEMBERS, MODERATE_MEMBERS (timeout), MANAGE_ROLES, MANAGE_CHANNELS, MANAGE_GUILD, VIEW_AUDIT_LOG, ADMINISTRATOR, and the voice, stage, expressions and events flags.
- **How permissions are computed.** The owner gets everything. Otherwise start with the `@everyone` role and OR in each of the member's roles, and if the result has ADMINISTRATOR the member gets everything. Channel overwrites then apply in this order: the `@everyone` overwrite (deny, then allow), all of the member's role overwrites combined (deny, then allow), and finally the member-specific overwrite. ADMINISTRATOR skips overwrites.
- **Implicit denies.** Without VIEW_CHANNEL a member gets nothing in that channel. Without SEND_MESSAGES a member loses MENTION_EVERYONE, ATTACH_FILES and EMBED_LINKS. Threads inherit the parent channel's permissions, and a private thread also requires being a thread member.
- **Hierarchy.** Role position matters only for managing others. You can assign, edit or reorder only roles below your highest role, you can grant only permissions you hold, and you can kick, ban or rename only members whose highest role is below yours. Permission resolution itself ignores position: any allow from a role wins over another role's deny at the same level.
- Categories can sync their overwrites down to their child channels. The sync is a copy made at that moment, not live inheritance.

### Realtime (Gateway)
- A WebSocket connection: Hello, then Identify, then Ready, kept alive by a heartbeat. A dropped connection can Resume and replay missed events by sequence number. Large bots are split across shards with `shard_id = (guild_id >> 22) % num_shards`.
- **Intents** are a subscription bitmask (GUILDS, GUILD_MEMBERS, GUILD_MESSAGES, MESSAGE_CONTENT, GUILD_MESSAGE_REACTIONS, GUILD_PRESENCES, DIRECT_MESSAGES, AUTO_MODERATION_EXECUTION, and others). Some intents are *privileged*: members, presences and message content need approval.
- Events are named after resources: `GUILD_CREATE`, `CHANNEL_UPDATE`, `THREAD_CREATE`, `THREAD_LIST_SYNC`, `THREAD_MEMBERS_UPDATE`, `MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE_BULK`, `MESSAGE_REACTION_ADD`, `TYPING_START`, `PRESENCE_UPDATE`, `GUILD_MEMBER_UPDATE`, `GUILD_AUDIT_LOG_ENTRY_CREATE`, `AUTO_MODERATION_ACTION_EXECUTION`, and others.
- On connect, the client gets a *lazy* guild snapshot through `GUILD_CREATE`. Large guilds send members on request, through `REQUEST_GUILD_MEMBERS`.
- Ephemeral state lives only on the gateway: presence, typing and voice state. It is never stored.
- Voice runs over a separate voice gateway plus UDP or WebRTC.

### Moderation
- Kick, ban (with the option to delete messages from the last N seconds), bulk ban, timeout (`communication_disabled_until`), and deleting or bulk-deleting messages (up to 100, no older than 14 days).
- **AutoMod rules** pair a trigger (keyword, spam, keyword preset, mention spam, member profile) with actions (block message, send alert to a channel, timeout). Each rule can exempt specific roles and channels.
- The **audit log** is an append-only list of entries `{action_type, user_id, target_id, changes[{key, old, new}], reason}`.
- Verification levels and membership screening (rules acceptance, the `pending` member state) gate new members. Slowmode is set per channel. Thread lock and archive are moderation tools too.

### Takeaways for an atproto design
- One permission vocabulary covers both chat and forum. Forum channels are threads plus tags plus a sort order, not a separate system.
- The overwrite algorithm is well understood and battle-tested. It needs a single authority to compute it, which in atproto means the community's service, not each user's PDS.
- Discord splits its data in two. Durable resources get REST and gateway events. Ephemeral state (presence, typing, voice) never touches storage. That split maps cleanly onto atproto: records for durable data, and a separate realtime channel for the ephemeral rest.

---

## 2. Discourse

### Resource model
- **Site** is a single community per install. Discourse has no multi-guild tenancy, so a "guild" corresponds to a whole Discourse site.
- **Category**: a hierarchy of category, subcategory and sub-subcategory. Each has a slug, colour, description topic, default view and sort order, a required-tags policy, `topic_template`, and per-group permissions. Settings include whether replies need approval, auto-close, and slow mode.
- **Topic** (the thread): title, category, tags, posters, `views`, `like_count`, `closed`, `archived`, `pinned` (globally or within its category, with an expiry), `visible` (listed or unlisted), `archetype` (`regular` or `private_message`), and an accepted-answer field when the Solved plugin is installed. PMs are topics with archetype `private_message` and a list of allowed users and groups.
- **Post**: `raw` (Markdown) plus `cooked` (rendered HTML), `post_number` (order within the topic), `reply_to_post_number` (soft threading, rendered flat), `version` with full **revision history**, `post_type` (regular, moderator_action, small_action, whisper), and `actions_summary` (likes, flags, bookmarks).
- **User**: `username`, `trust_level` (0 to 4), group memberships, `primary_group`, flair, badges, admin and moderator flags, `silenced_till` and `suspended_till`. User fields, user status and per-user preferences live here too.
- **Group**: automatic groups (`everyone`, `trust_level_0` to `trust_level_4`, `staff`, `admins`, `moderators`) and custom groups with visibility, mentionable and messageable levels, membership requests and owners.
- **Tag** and **tag group**: tag groups can restrict which tags a category may use, and some tags can be staff-only.
- **Other**: badges, notifications (more than 30 types), bookmarks, drafts, uploads, invites, user actions (an activity stream), reviewables (the review queue), webhooks and themes.
- **Discourse Chat** is a core plugin since 3.x. It adds chat channels, each attached to a category (or a DM). Channel permissions follow that category's, and channels have threads. Chat is therefore Discourse's answer to Discord, and it shows a forum product converging toward one model.

### REST surface
- Mostly the same routes as the web UI, with `.json` added: `/latest.json`, `/top.json`, `/c/{slug}/{id}.json`, `/t/{id}.json`, `/t/{id}/posts.json?post_ids[]=`, `POST /posts.json` (creates a topic or a reply), `PUT /posts/{id}`, `/posts/{id}/revisions/{n}`, `/categories.json`, `/u/{username}.json`, `/groups/{name}/members.json`, `/tag/{name}.json`, `/search.json?q=`, `/notifications.json`, `/review.json`, and admin routes under `/admin/...`. Chat lives under `/chat/api/channels/...`.
- Topic lists paginate by page and timestamp. Inside a topic, a "post stream" sends all post IDs first, and the client then fetches post bodies in chunks.
- **Auth** comes in three forms. Admin API keys use the `Api-Key` and `Api-Username` headers. **User API keys** come from an OAuth-like grant flow with scopes (`read`, `write`, `message_bus`, `push`, `notifications`, `session_info`, and others), meant for third-party clients. DiscourseConnect gives SSO.
- Rate limits are set per site, with per-user, per-IP and per-action counters (for example "new topics per day").

### Permissions
- **Category security** gives each group one of three levels: *See*, *Reply* (which includes See) or *Create* (which includes Reply). That is the whole matrix. There are no per-topic overrides, but PMs and whispers bypass it.
- **Trust levels** grant site-wide abilities automatically, based on activity (days visited, posts read, time spent, likes given and received). For example, TL0 can't post links or images, TL1 can flag, TL2 can invite and edit wiki posts, TL3 (Regular) can recategorise topics, rename titles and hide spam, and TL4 (Leader) gets near-moderator powers. Most of these thresholds are site settings, and many settings take a group or a trust level as their value (for example `create_tag_allowed_groups`).
- **Roles** are just user flags: admin and moderator. A *category moderator group* gives moderator powers limited to one category.
- Discourse has no bitfield. Abilities are scattered across site settings, each naming the groups that hold it. A real installation is very configurable, but it can't be read back as a single permission set.

### Realtime (MessageBus)
- MessageBus is a pub/sub system over HTTP long-polling, which can also fall back to polling. Clients subscribe to named channels with a last-seen ID, for example `/latest`, `/topic/{id}`, `/notification/{user_id}`, `/presence/...` and `/chat/{channel_id}`. Messages can be targeted at user IDs, group IDs or client IDs, so permission filtering happens when a message is published.
- The payloads are usually small invalidation hints, such as "topic 123 has a new post". The client then refetches over REST. Discord does the opposite and pushes full objects.
- A presence plugin, now in core, handles "who's replying" and "who's here". It is ephemeral and stored in Redis.
- **Webhooks** are outbound. They're configured per event type (topic, post, user, group, category, tag, reviewable, chat) and can be filtered by category, tag or group.

### Moderation
- **Flags** (spam, inappropriate, off-topic, illegal, "something else" to moderators) feed the **review queue** (`Reviewable`). Enough flags weighted by trust ("flag score") auto-hide a post until a moderator reviews it.
- Post approval queues hold posts from new users, from specific categories, or posts matching watched words. **Watched words** can block, require approval, flag, censor, replace, tag, link, or silence the poster.
- Users can be silenced (they can't post) or suspended (they can't log in), with a reason and a duration. Admins can also *anonymise* or delete users. Moderators can see IPs and other accounts sharing them.
- Topic actions include close, archive, unlist, pin and banner, split or merge posts into topics, move posts, change the owner, timed close or delete, and slow mode. Posts can be hidden, deleted (soft deleted, so staff can still see them), locked against edits, or turned into a wiki. Whispers are staff-only posts inside a topic.
- The **staff action log** is an audit log of moderator actions, with screened emails, IPs and URLs alongside it.

### Takeaways for an atproto design
- The permission model is coarse: *See*, *Reply* and *Create*, granted to groups per container. It covers most forum needs and is easy to explain. Trust levels are a reputation-derived way of filling groups automatically.
- Discourse sends invalidation hints over realtime and refetches over REST. That works well with atproto, where the firehose or Jetstream says "this record changed" and an AppView serves the hydrated views.
- Revision history and soft delete are first-class in Discourse. In atproto a record update replaces the old version, so keeping history would need explicit design: a CID chain, or the AppView keeping old versions.
- Moderation runs on a queue: flag, then review, then act. That matches atproto's labeler and report model (`com.atproto.moderation.createReport`, `tools.ozone.*`) closely.

---

## 3. Side-by-side

| Concept | Discord | Discourse | Existing `garden.msg` work |
|---|---|---|---|
| Community | Guild (many per user) | Site (one per install) | Community DID or space (Colibri), forum DID (atmoBB) |
| Grouping | Category (a channel type), one level | Category tree, three levels | `container` URI |
| Chat container | Text channel | Chat channel (attached to a category) | Colibri `channel.text` space |
| Forum container | Forum or media channel | Category | atmoBB `forum.board` |
| Thread | A thread channel (`parent_id`), optionally started from a message | Topic | `garden.msg.thread` (`origin` = starting message) |
| Message or post | Message, flat, reply by reference | Post, `post_number`, soft `reply_to` | `garden.msg.post` (`thread` and `parent`) |
| Tags | Forum `available_tags`, max 5 per thread | Tags and tag groups | `tags` (max 8) |
| Lock or close | `locked`, `archived` | `closed`, `archived` | `locked`, `closedAt` |
| Edit history | None exposed | Full revisions | `updatedAt` only |
| Permission unit | 64-bit flags, with role and member overwrites per channel | See, Reply and Create per group per category, plus trust-level settings | Colibri `visibleToRoles` and `visibleToMembers` (read only) |
| Roles and groups | Ordered roles, with a hierarchy | Unordered groups, plus automatic trust-level groups | Colibri roles (record keys) |
| Realtime | Gateway WebSocket that pushes full objects, with intents | MessageBus long-poll that sends hints | Firehose or Jetstream (public). Spaces are still open |
| Ephemeral state | Presence, typing, voice (gateway only) | Presence (Redis) | Not covered |
| Moderation | Kick, ban, timeout, AutoMod, audit log | Flags, review queue, silence, suspend, watched words, staff log | atmoBB `moderation.action`, Colibri labels |
| Third-party auth | OAuth2 with scopes, bot tokens | User API keys with scopes, admin keys | atproto OAuth with permission sets |

---

## 4. What atproto changes

These points come from how atproto works, not from either app, and the design will run into each of them.

1. **Who owns the write.** In both products the server owns all data. In atproto, posts usually live in each author's repo, as atmoBB does, while community state (channels, roles, membership, bans) lives in the community's repo or space. Colibri also puts thread metadata in the community's repo. The permission model therefore splits in two: the author's PDS decides *what you write*, and the community's service decides *whether it counts*, meaning whether the AppView indexes it and whether readers see it. Discord's "can't send" becomes "can write the record, but the community ignores it".
2. **Private content.** Discord's VIEW_CHANNEL and Discourse's *See* level both need non-public data. Public atproto repos can't express that, so private channels and threads depend on permissioned spaces, the model Colibri is already drafting against, with space credentials issued by the community. The design will have to track the state of the spaces work.
3. **Realtime.** The public firehose and Jetstream already resemble Discourse's MessageBus: change notifications that a client hydrates through an AppView. A Discord-style typed event stream with intents could be offered as an XRPC `subscribe*` endpoint on the AppView. Typing and presence need a channel that isn't stored at all.
4. **Moderation is two-layered.** Network-level moderation uses labels and Ozone reports. Community moderation (bans, timeouts, locks, deletions) is community-written records that the AppView enforces. atmoBB already has `moderation.action`. A ban can't remove a user's own records. It only stops them from being indexed or shown.
5. **IDs.** Discord snowflakes and atproto TIDs are both sortable by time, so `before`/`after` cursors carry over. Records are addressed by at-uri, and strongRefs (uri plus cid) give version pinning, which is atmoBB's finding 4.
6. **XRPC shape.** Lexicon queries and procedures replace REST verbs (`<ns>.getThread`, `<ns>.listMessages`, `<ns>.createReport`), and lexicon `subscription` types give a WebSocket. Bluesky's split between `app.bsky.*` (AppView views) and record lexicons is the precedent for keeping *records* (`garden.msg.*`) separate from the *API views* that hydrate them.

## 5. Questions for the design, and how they were answered
Each answer points to its item in [atmo-board-requirements.md](atmo-board-requirements.md).

- **Permission vocabulary: Discord flags, Discourse levels, or a core plus extensions?** Discourse-style. Each channel grants each group See, Reply or Create, and the groups include the automatic trust-level groups and staff (item 5). Trust levels lead the moderation design (item 4): the code maps them to a few abilities (flag at TL1, rename and move at TL3, pin, lock and hide at TL4, everything else for staff).
- **Where do roles, membership and overwrites live, and who can verify them?** atmoBB's split (item 7). Membership, posts and likes are member-owned records in each member's repo. Channels, staff grants, manual trust levels and moderation actions are forum-signed records in the forum's repo, so any appview can verify them. Automatic trust levels TL0 to TL3 are computed by the appview from private data, and only the resulting role is published. Each forum is an Atmospheric Group, so staff and trust levels are roles on its membership records (item 17). Permissioned spaces are used only for private channels and whispers.
- **One generic API for many apps, or a shared lexicon of views each app serves?** Neither up front. atmo-board designs its own API first, and shared lexicons are inferred from it later (item 8).
- **How far do chat and forum share endpoints?** Completely. Discourse Chat's separate container is treated as an anti-pattern. There is one model of channels, threads and posts, with one set of endpoints, one post record and one permission model (item 9). A channel is itself a thread, and its own posts are its untitled chat (items 12 and 18).
- **Realtime: hints and refetch, or full objects with intents?** Hints and refetch, kept slow and cheap. Pages are server-rendered, and a visible tab polls a cacheable change query every 10 to 30 seconds. There are no WebSockets or gateway; Server-Sent Events can come later if needed (item 10).
- **Are edit history, soft delete and whispers in scope?** Yes, all three (item 11), and all three are now built. The appview keeps each version of a post, staff hide posts through forum-signed overrides, author deletes are honoured fully, and whispers live in a staff-only space.
