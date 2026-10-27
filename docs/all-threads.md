# Threads all the way down

atmo-board has one discussion model. A channel, a named thread and a channel's untitled chat are all made from the same two records, a **thread** and a **post**. "Chatty" and "forum-like" describe how a thread is presented and paced, not what kind of resource it is.

This combines items 9, 12 and 18 of `atmo-board-requirements.md` in the project notes.

## One model for chat and forum (item 9)

Discourse Chat is the anti-pattern here. It puts chat in a separate container with its own model, so a site ends up with two discussion systems side by side. In atmo-board the whole discussion is made of channels, threads and posts, which means:

- **One post record** (`dev.atmoboard.post`) for a chat message and a forum reply alike.
- **One set of endpoints**, such as `getThread`, `listThreads`, `listPosts` and `createPost`, whatever the thread is used for.
- **One permission model**: See, Reply and Create per group, set on the channel and inherited by everything in it.

This also settles finding 2 in the apps README (`garden.msg.post` doesn't suit chat) in favour of a single post model.

## A channel is a thread (item 18)

There is one thread record, `dev.atmoboard.thread`, with an optional `parent`.

- **A top-level thread** has no `parent`. Only staff can create one.
- **A channel** is a top-level thread that the group features in the sidebar. The group writes a `dev.atmoboard.channel` record for it (position, section, icon and description), and that record is the only difference. Promoting a thread to a channel means writing that record, and demoting it means deleting it.
- **A named thread** is a thread whose `parent` is a channel. It has a title, and its opening post is the thread record's own content.

The records are written by their authors and live in the forum's space. A thread inherits its parent's space, so a **private channel** is a channel whose whole subtree lives in its own space, readable only by the roles on its access list.

**Depth.** The model allows threads inside threads at any depth. The UI shows two levels, channel and then thread, as Discord does.

## Untitled chat (item 12)

Each channel has an untitled chat, like Zulip's "general chat". People can post there without anyone opening a named thread first.

The chat is the channel thread's own posts, and the channel's named threads are its children. So there is no separate untitled thread to create alongside each channel: the channel record is the chat. An earlier version of item 12 described it as "a default untitled thread per channel". That is the same feature for users, but it would have meant a second record per channel to create and keep in sync.

In the UI, a channel's page starts with a `{channel}/chat` row above its named threads, at `/c/{key}/{slug}/chat`. Chat rows show no unread counts.

## Moving

A move changes a thread's parent through a forum-signed `dev.atmoboard.override` record, so the author's own record is never rewritten. Moves are checked in two ways:

- **No cycles.** A thread can't be moved inside itself.
- **No crossing spaces.** Records stay in the space they were written to, so a thread can't move between a public and a private channel yet.

Moving and renaming threads needs TL3 or staff.

**Still open:** splitting a chat message out of a channel's chat into a new named thread. The model supports it, because it would be another override that gives the post a new parent, but it isn't built.
