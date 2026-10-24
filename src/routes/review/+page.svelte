<script lang="ts">
  import { enhance } from '$app/forms';
  import Avatar from '$lib/components/Avatar.svelte';
  import { age, fullDate } from '$lib/time';
  import { displayName, threadHref } from '$lib/names';
  let { data } = $props();
  const REASONS: Record<string, string> = { spam: 'Spam', offtopic: 'Off topic', inappropriate: 'Inappropriate', other: 'Something else' };
  const where = (item: typeof data.items[number]) =>
    item.thread ? threadHref(item.thread, item.post.number > 1 ? item.post.number : undefined) : `/p/${item.post.key}`;
</script>

<svelte:head><title>Review · {data.forum.name}</title></svelte:head>

<div class="page">
  <div class="page-head">
    <div class="grow">
      <h1>Review</h1>
      <p>Posts members have flagged. Agreeing hides the post; disagreeing lifts a hide the flags caused.</p>
    </div>
  </div>
  <div class="pills">
    <a class="pill" class:on={data.status === 'open'} href="/review">Open</a>
    <a class="pill" class:on={data.status === 'all'} href="/review?status=all">All</a>
  </div>

  {#if data.items.length === 0}
    <p class="empty">{data.status === 'open' ? 'Nothing waiting. The queue is empty.' : 'Nothing has been flagged yet.'}</p>
  {:else}
    <ol class="queue">
      {#each data.items as item (item.subject)}
        <li>
          <div class="post">
            <Avatar author={item.post.author} size={32} />
            <div class="main">
              <div class="top">
                <a class="who" href="/u/{item.post.author.handle ?? item.post.author.did}">{displayName(item.post.author)}</a>
                <a class="where" href={where(item)} data-sveltekit-reload>{item.thread?.title ?? 'chat'}</a>
                {#if item.post.hidden}<span class="tag">hidden</span>{/if}
                <span class="when" title={fullDate(item.post.createdAt)}>{age(item.post.createdAt)}</span>
              </div>
              <p class="text">{item.post.textContent}</p>
            </div>
          </div>
          <ul class="reports">
            {#each item.reports as r (r.reporter.did + r.createdAt)}
              <li class:closed={r.status !== 'open'}>
                <strong>{REASONS[r.reason] ?? r.reason}</strong>
                from <a href="/u/{r.reporter.handle ?? r.reporter.did}">{displayName(r.reporter)}</a>
                {#if r.note}<span class="note">“{r.note}”</span>{/if}
                <span class="when" title={fullDate(r.createdAt)}>{age(r.createdAt)}</span>
                {#if r.status !== 'open'}<span class="tag">{r.status}</span>{/if}
              </li>
            {/each}
          </ul>
          {#if item.reports.some((r) => r.status === 'open')}
            <div class="actions">
              {#each [
                { status: 'agreed', hide: !item.post.hidden, label: item.post.hidden ? 'Agree' : 'Agree and hide' },
                { status: 'disagreed', hide: false, label: 'Disagree' },
                { status: 'ignored', hide: false, label: 'Ignore' },
              ] as choice (choice.status)}
                <form method="POST" action="?/resolve" use:enhance={() => async ({ update }) => update({ reset: false })}>
                  <input type="hidden" name="subject" value={item.subject} />
                  <input type="hidden" name="status" value={choice.status} />
                  {#if choice.hide}<input type="hidden" name="hide" value="1" />{/if}
                  <button class="btn" class:primary={choice.status === 'agreed'}>{choice.label}</button>
                </form>
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .page-head p { max-width: 60ch; }
  .queue { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 14px; }
  .queue > li { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; background: var(--surface); }
  .post { display: flex; gap: 10px; }
  .main { min-width: 0; flex: 1; }
  .top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .who { font-weight: 600; color: var(--text); }
  .where { color: var(--accent); font-size: 14px; }
  .when { color: var(--muted); font-size: 13px; margin-left: auto; }
  .text { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .reports { list-style: none; margin: 10px 0 0; padding: 8px 0 0; border-top: 1px solid var(--border);
    display: grid; gap: 4px; font-size: 14px; }
  .reports li { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .reports .closed { color: var(--muted); }
  .note { color: var(--text-2); }
  .tag { font-size: 11px; padding: 0 6px; border-radius: 4px; background: var(--surface-2); color: var(--muted); }
  .actions { display: flex; gap: 8px; margin-top: 10px; }
  .empty { color: var(--muted); }
</style>
