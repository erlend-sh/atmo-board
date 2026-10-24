<script lang="ts">
  import type { Author, ThreadView } from '$lib/types';
  import { age, fullDate } from '$lib/time';
  import { channelHref, displayName, threadHref } from '$lib/names';
  import { channelLabel } from '$lib/directories';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  /** A channel's own chat, shown as a speech bubble above its threads. */
  // Chat never shows a count (busy chats run high); unread just bolds it.
  type ChatRow = { href: string; unread: boolean; participants: Author[]; active: number; lastActivityAt?: string };
  let { threads, channels = {}, chat, empty = 'No threads yet.' }: {
    threads: ThreadView[]; channels?: Record<string, { title: string; slug: string; key: string; icon?: string; private?: boolean }>;
    chat?: ChatRow; empty?: string;
  } = $props();
  // -1: a thread the viewer has never opened; otherwise the unread post count.
  const unread = (t: ThreadView) => (t.lastReadNumber === undefined ? -1 : Math.max(0, t.postCount - t.lastReadNumber));
  const showChannel = $derived(Object.keys(channels).length > 0);
</script>

{#if threads.length === 0 && !chat}
  <p class="empty">{empty}</p>
{:else}
  <ol class="list" class:no-chan={!showChannel}>
    {#if chat}
      <li class="chat-row">
        <span class="marks"></span>
        <a class="t" class:read={!chat.unread} href={chat.href}><span class="tt">chat</span><span class="active">{chat.active} {chat.active === 1 ? 'person' : 'people'} recently active</span></a>
        <span class="faces">{#each chat.participants as p (p.did)}<span title={displayName(p)}><Avatar author={p} size={22} /></span>{/each}</span>
        {#if chat.lastActivityAt}<a class="age" href={chat.href} title={fullDate(chat.lastActivityAt)}>{age(chat.lastActivityAt)}</a>{:else}<span></span>{/if}
        <svg class="tail" viewBox="0 0 22 14" aria-hidden="true"><path class="fill" d="M19 -1.5V0C19 6 15 11.5 2 13C9 9.5 11 5 11 0V-1.5Z" /><path class="edge" d="M19 0C19 6 15 11.5 2 13C9 9.5 11 5 11 0" /></svg>
      </li>
    {/if}
    {#each threads as t (t.key)}
      {@const n = unread(t)}
      {@const ch = t.parent ? channels[t.parent] : undefined}
      <li>
        <span class="marks">
          {#if n === -1}<span class="dot" title="New thread"></span>{:else if n > 0}<span class="count" title="{n} unread">{n}</span>{/if}
          {#if t.state.pinned}<span class="flag" title="Pinned"><Icon name="pin" /></span>{/if}
          {#if t.state.locked}<span class="flag" title="Locked"><Icon name="lock" size={13} /></span>{/if}
          {#if t.state.hidden}<span class="flag" title="Hidden, staff only">🚫</span>{/if}
        </span>
        <a class="t" class:read={n === 0} href={threadHref(t)}><span class="tt">{t.title ?? 'Untitled'}</span></a>
        <span class="faces" title="{t.postCount} posts">
          {#each (t.participants ?? [t.author]).slice(0, 5) as p (p.did)}<span title={displayName(p)}><Avatar author={p} size={22} /></span>{/each}
        </span>
        {#if showChannel}
          {#if ch}<a class="chan" href={channelHref(ch)}>{#if ch.icon}{ch.icon}{:else}<Icon name={ch.private ? 'lock' : 'hash'} size={13} />{/if}<span class="cn">{channelLabel(ch)}</span></a>{:else}<span></span>{/if}
        {/if}
        <a class="age" href={threadHref(t, t.postCount)} title={fullDate(t.lastActivityAt)}>{age(t.lastActivityAt)}</a>
      </li>
    {/each}
  </ol>
{/if}

<style>
  /* One line per thread: markers | title | participants | channel | time. The
     titles start where the top bar's heading text does (--head-x), and the
     markers sit centred under its icon. The whole row is the thread's link. */
  .list { list-style: none; margin: 0; padding: 0; }
  li { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr) 110px 170px 52px; gap: 14px; align-items: center;
    padding: 9px 10px 9px max(0px, calc(var(--head-x) - 42px)); border-radius: 8px; transition: background-color .15s; }
  .no-chan li { grid-template-columns: 28px minmax(0, 1fr) 110px 52px; }
  li:hover { background: var(--surface-2); }
  .t::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
  .chan, .age, .faces { position: relative; z-index: 1; }
  .marks { display: flex; gap: 5px; align-items: center; justify-content: center; transform: translateX(14px); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: color-mix(in srgb, var(--muted) 55%, var(--bg)); }
  .marks .count { background: var(--hover); color: var(--text-2); }
  .flag { color: var(--muted); display: inline-flex; }
  .t { font-weight: 600; font-size: 15px; display: flex; gap: 7px; align-items: baseline; min-width: 0; color: var(--text); }
  .t.read { font-weight: 400; color: var(--muted); }
  .tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .faces { display: flex; justify-content: flex-end; }
  .faces > span { margin-left: -6px; border-radius: 50%; box-shadow: 0 0 0 2px var(--bg); display: inline-flex; }
  .faces > span:first-child { margin-left: 0; }
  .chan { color: var(--muted); font-size: 13px; display: inline-flex; gap: 3px; align-items: center; white-space: nowrap; min-width: 0; }
  .cn { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .chan:hover, .age:hover { color: var(--text); }
  .age { color: var(--muted); font-size: 13px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  /* The channel's chat: a wide speech bubble, tail at the bottom right, inset
     16px with the marker column shrunk to match. */
  .list li.chat-row { --bub: var(--bg); margin: 2px 0 14px 16px; grid-template-columns: 11px minmax(0, 1fr) 110px 52px;
    border: 1px solid var(--border); border-radius: 14px; background: var(--bub); }
  .list li.chat-row:hover { --bub: var(--surface-2); }
  .tail { position: absolute; right: 22px; bottom: -8.5px; width: 14.7px; height: 9.3px; overflow: visible; pointer-events: none; }
  .tail .fill { fill: var(--bub); transition: fill .15s; }
  .tail .edge { fill: none; stroke: var(--border); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .active { font-size: 13px; font-weight: 400; color: var(--muted); white-space: nowrap; }
  @media (max-width: 1100px) {
    li { grid-template-columns: 28px minmax(0, 1fr) 140px 52px; }
    .no-chan li { grid-template-columns: 28px minmax(0, 1fr) 52px; }
    .list li.chat-row { grid-template-columns: 11px minmax(0, 1fr) 52px; }
    .faces { display: none; }
  }
  @media (max-width: 820px) {
    .list { margin-left: -10px; }
    li, .no-chan li { grid-template-columns: 34px minmax(0, 1fr) auto auto; gap: 8px; padding-left: 10px; }
    .list li.chat-row { margin-left: 0; grid-template-columns: 33px minmax(0, 1fr) auto auto; }
    .marks { transform: none; }
    .chan { max-width: 34vw; }
    .tt { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
  }
  @media (prefers-reduced-motion: reduce) { li { transition: none; } }
</style>
