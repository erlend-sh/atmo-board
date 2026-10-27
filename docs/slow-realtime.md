# Slow realtime

atmo-board has chat, but it isn't a chat app. A channel's untitled chat and its named threads are the same thing underneath (see [all-threads.md](all-threads.md)), so chat gets the same delivery as the rest of the forum: server-rendered pages that check for changes every 15 seconds. That is fast enough for a conversation that moves at forum pace, and it costs almost nothing to run.

This explains item 10 of `atmo-board-requirements.md` in the project notes.

## The job to be done

atmo-board is a web-first forum. What matters most is that pages load fast, as fast as atmoBB's or faster, and that they work for a reader who isn't signed in, on a slow phone, or arriving from a search engine.

Chat matters too, but as a way of talking inside a forum, not as a replacement for Discord. People drop into a channel's chat to ask something quick, follow along for a while, and leave. A few seconds of delay is fine for that. What isn't needed is the machinery of a low-latency chat app:

- No WebSockets, and no gateway that holds a connection open for every reader.
- No per-user fan-out, where the server pushes each new message to every member who might see it.
- No presence or typing indicators.

Fast realtime is for native apps, later. They can add a push channel on top of the same data without changing the model.

## How it works

1. **The page is server-rendered.** A thread, a channel or a channel's chat arrives as finished HTML with its posts already in it, so it loads fast and needs no JavaScript to read.
2. **Every change is logged.** When the appview indexes a post, an edit, a delete, a reaction, a move or any other change, it adds a row to a change log (`ab_changes`) with a rising sequence number and the thread and channel it belongs to.
3. **The page gets a cursor.** Each page load includes the latest sequence number at the time it was built.
4. **A visible tab polls.** While the tab is visible, the page asks every 15 seconds whether anything changed since its cursor. It asks again as soon as the tab becomes visible, and not at all while it's hidden.
5. **The answer is a hint, not the content.** `dev.atmoboard.getChanges` returns only which keys changed (for example "post `x` in thread `y`") and a new cursor. If anything changed, the page refetches its own data and redraws.

Each page asks about only what it shows. A thread asks about that thread, a channel page asks about the channel and its threads, and Latest asks about everything.

This is the same split Discourse makes with its MessageBus: small invalidation hints over the wire, and the full views fetched the normal way. Discord does the opposite and pushes full objects to every client, which is what makes it expensive to run.

### Chat on top of this

Chat uses exactly the same pages and the same poll. A few things make it feel like chat:

- **Your own messages appear at once.** Sending a message submits the form, the appview indexes the post as it's written, and the page refreshes. Only other people's messages wait for the next poll.
- **The chat view is laid out for chat:** compact consecutive messages from the same person, newest at the bottom, and Enter to send (Shift+Enter for a new line).
- **Other people's messages arrive within about 15 seconds.** That is slow for a lively back-and-forth, and fine for the pace of a forum channel.

## Why this is cheap

- **Polls are tiny.** Each one reads the change log forward from its cursor, and the answer is a few keys. An idle channel answers "nothing changed".
- **Hidden tabs cost nothing.** Most open tabs are in the background, and they don't poll.
- **No connection state.** The server holds nothing per reader between polls, so it scales like any other web page. A load balancer or a restart drops nothing.
- **It can be cached.** A change query for a public thread or channel gives the same answer to everyone, so a CDN or edge cache can absorb the polls. (Today the endpoint sends `no-store`, because the private parts of a page, such as whispers and unread state, come through the same refetch. Caching the public hint is a later optimisation.)

## Where it can go later

- **A shorter interval.** The requirements allow 10 to 30 seconds. 15 is a middle value and is one constant in `src/lib/components/Poller.svelte`.
- **Server-Sent Events**, if polling proves too slow. The same hints would be pushed down one long-lived HTTP response instead of being asked for, with no change to the data model.
- **A native push channel** for apps that want true realtime. It would carry the same change log.

## Where it lives in the code

| Part | File |
|---|---|
| Change log table | `appview/schema.sql` (`ab_changes`) |
| Logging a change | `log_change` in `appview/lua/_lib.lua` |
| The hint query | `appview/lua/getChanges.lua` |
| Web proxy for the poll | `src/routes/api/changes/+server.ts` |
| The poller | `src/lib/components/Poller.svelte`, used by the Latest, channel and thread pages |
