<script lang="ts">
  import type { ThreadView } from '$lib/types';
  import { age, fullDate } from '$lib/time';
  import { displayName, threadHref } from '$lib/names';
  import Avatar from './Avatar.svelte';
  let { threads, channels = {}, empty = 'No threads yet.' }:
    { threads: ThreadView[]; channels?: Record<string, { title: string; slug: string; key: string; icon?: string }>; empty?: string } = $props();
  // -1: a thread the viewer has never opened; otherwise the unread post count.
  const unread = (t: ThreadView) => (t.lastReadNumber === undefined ? -1 : Math.max(0, t.postCount - t.lastReadNumber));
  const showChannel = $derived(Object.keys(channels).length > 0);
</script>

{#if threads.length === 0}
  <p class="empty">{empty}</p>
{:else}
  <ol class="threads" class:no-chan={!showChannel}>
    {#each threads as t (t.key)}
      {@const n = unread(t)}
      {@const ch = t.parent ? channels[t.parent] : undefined}
      <li>
        <span class="marks">
          {#if n === -1}<span class="dot" title="New thread"></span>{:else if n > 0}<span class="count" title="{n} unread">{n}</span>{/if}
          {#if t.state.pinned}<span title="Pinned">📌</span>{/if}
          {#if t.state.locked}<span title="Locked">🔒</span>{/if}
        </span>
        <a class="title" class:read={n === 0} href={threadHref(t)}>{t.title ?? 'Untitled'}</a>
        <span class="faces" title="{t.postCount} posts">
          {#each t.participants ?? [t.author] as p (p.did)}<span title={displayName(p)}><Avatar author={p} size={22} /></span>{/each}
        </span>
        {#if showChannel}
          {#if ch}<a class="chan" href="/c/{ch.slug}/{ch.key}">{ch.icon ?? '#'} {ch.title}</a>{:else}<span></span>{/if}
        {/if}
        <a class="age" href={threadHref(t, t.postCount)} title={fullDate(t.lastActivityAt)}>{age(t.lastActivityAt)}</a>
      </li>
    {/each}
  </ol>
{/if}

<style>
  /* One line per thread: markers | title | participants | channel | time.
     The marker column is always reserved so titles line up. */
  .threads { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
  li { display: grid; grid-template-columns: 52px minmax(0, 1fr) 120px 128px 44px; gap: 14px; align-items: center;
    padding: 9px 4px; border-bottom: 1px solid var(--border); }
  .no-chan li { grid-template-columns: 52px minmax(0, 1fr) 120px 44px; }
  .marks { display: flex; gap: 5px; align-items: center; font-size: 12px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); margin: 0 5px; }
  .title { font-weight: 600; font-size: 15.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title.read { font-weight: 500; color: var(--text-2); }
  .faces { display: flex; }
  .faces > span { margin-left: -6px; border-radius: 50%; box-shadow: 0 0 0 2px var(--bg); display: inline-flex; }
  .faces > span:first-child { margin-left: 0; }
  .chan { color: var(--muted); font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .age { color: var(--muted); font-size: 13.5px; text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: var(--muted); padding: 24px 0; }
  @media (max-width: 600px) {
    li, .no-chan li { grid-template-columns: 46px minmax(0, 1fr) auto auto; gap: 8px; }
    .faces { display: none; }
  }
</style>
