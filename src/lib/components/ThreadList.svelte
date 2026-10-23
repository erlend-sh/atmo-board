<script lang="ts">
  import type { ThreadView } from '$lib/types';
  import { age, fullDate } from '$lib/time';
  import { displayName, threadHref } from '$lib/names';
  import Avatar from './Avatar.svelte';
  let { threads, channels = {} }: { threads: ThreadView[]; channels?: Record<string, { title: string; slug: string; key: string }> } = $props();
  const unread = (t: ThreadView) => t.lastReadNumber !== undefined && t.postCount > t.lastReadNumber;
  const isNew = (t: ThreadView) => t.lastReadNumber === undefined;
</script>

{#if threads.length === 0}
  <p class="empty">No threads yet.</p>
{:else}
  <ol class="threads">
    {#each threads as t (t.key)}
      <li class:pinned={t.state.pinned}>
        <Avatar author={t.author} size={32} />
        <div class="title">
          <a href={threadHref(t)} class:read={!unread(t) && !isNew(t)}>
            {#if t.state.pinned}<span title="Pinned">📌</span>{/if}
            {#if t.state.locked}<span title="Locked">🔒</span>{/if}
            {#if t.state.resolved}<span title="Resolved">✔</span>{/if}
            {t.title ?? 'Untitled'}
          </a>
          <div class="meta">
            {#if t.parent && channels[t.parent]}<a class="chan" href="/c/{channels[t.parent].slug}/{t.parent}">#{channels[t.parent].title}</a>{/if}
            <span>{displayName(t.author)}</span>
            {#each t.tags as tag}<a class="tag" href="/tag/{tag}">{tag}</a>{/each}
          </div>
        </div>
        <span class="count" title="{t.postCount} posts">
          {t.postCount}{#if unread(t)}<span class="dot" title="{t.postCount - (t.lastReadNumber ?? 0)} unread">{t.postCount - (t.lastReadNumber ?? 0)}</span>{/if}
        </span>
        <a class="age" href={threadHref(t, t.postCount)} title={fullDate(t.lastActivityAt)}>{age(t.lastActivityAt)}</a>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .threads { list-style: none; margin: 0; padding: 0; }
  li { display: grid; grid-template-columns: 32px 1fr auto 48px; gap: 12px; align-items: center;
    padding: 10px 4px; border-bottom: 1px solid var(--border); }
  .title { min-width: 0; }
  .title > a { font-weight: 600; font-size: 16px; color: var(--text); overflow-wrap: anywhere; }
  .title > a.read { font-weight: 500; color: var(--text-2); }
  .meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--muted); margin-top: 2px; }
  .chan { color: var(--accent); }
  .tag { color: var(--muted); padding: 0 6px; border-radius: 4px; background: var(--surface-2); }
  .count { color: var(--muted); font-size: 14px; text-align: right; display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
  .dot { background: var(--accent); color: var(--on-accent); border-radius: 10px; padding: 0 6px; font-size: 12px; font-weight: 600; }
  .age { color: var(--muted); font-size: 14px; text-align: right; }
  .empty { color: var(--muted); padding: 24px 0; }
  @media (max-width: 600px) { li { grid-template-columns: 28px 1fr auto; } .age { display: none; } }
</style>
