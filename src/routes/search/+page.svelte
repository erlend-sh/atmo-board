<script lang="ts">
  import TopBar from '$lib/components/TopBar.svelte';
  import { page } from '$app/state';
  import Avatar from '$lib/components/Avatar.svelte';
  import { age, fullDate } from '$lib/time';
  import { channelHref, displayName, threadHref } from '$lib/names';
  import { channelLabel } from '$lib/directories';
  import type { PostHit } from '$lib/types';
  let { data } = $props();
  const channels = $derived(new Map(data.sections.flatMap((s) => s.channels).map((c) => [c.key, c])));

  const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  // About 200 characters around the first match, with the search words marked.
  function snippet(text: string, q: string) {
    const words = q.split(/\s+/).filter(Boolean);
    const found = words.map((w) => text.toLowerCase().indexOf(w.toLowerCase())).filter((i) => i >= 0);
    const at = found.length ? Math.min(...found) : 0;
    const start = Math.max(0, at - 60);
    let out = escape((start ? '…' : '') + text.slice(start, start + 200) + (text.length > start + 200 ? '…' : ''));
    for (const w of words) out = out.replace(new RegExp(`(${escape(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
    return out;
  }
  function where(hit: PostHit) {
    const t = hit.thread;
    if (t.isChannel) return { href: `/p/${hit.post.key}`, label: `${channelLabel(channels.get(t.key) ?? { title: t.title ?? '' })}/chat`, channel: channels.get(t.key) };
    return { href: threadHref(t, hit.post.number > 1 ? hit.post.number : undefined), label: t.title ?? 'Untitled', channel: t.parent ? channels.get(t.parent) : undefined };
  }
  const more = $derived.by(() => {
    const u = new URL(page.url);
    if (data.cursor) u.searchParams.set('cursor', data.cursor);
    return u.pathname + u.search;
  });
</script>

<svelte:head><title>{data.q ? `${data.q} · ` : ''}Search · {data.forum.name}</title></svelte:head>

<TopBar icon="search" title="search" />
<div class="page">
  <form class="search" method="GET" action="/search" data-sveltekit-keepfocus>
    <input type="search" name="q" value={data.q} placeholder="Search posts and chat" aria-label="Search" />
    {#each ['author', 'thread'] as k}
      {#if page.url.searchParams.get(k)}<input type="hidden" name={k} value={page.url.searchParams.get(k)} />{/if}
    {/each}
    <button class="btn primary">Search</button>
  </form>
  {#if page.url.searchParams.get('author') || page.url.searchParams.get('thread')}
    <p class="narrow">Narrowed to {page.url.searchParams.get('author') ? 'one member' : 'one thread'}. <a href="/search?q={encodeURIComponent(data.q)}">Search everything</a></p>
  {/if}

  {#if data.searched}
    {#if data.hits.length === 0}
      <p class="empty">Nothing found{data.q ? ` for “${data.q}”` : ''}.</p>
    {:else}
      <ol class="hits">
        {#each data.hits as hit (hit.post.key)}
          {@const w = where(hit)}
          <li>
            <Avatar author={hit.post.author} size={28} />
            <div class="main">
              <div class="top">
                <a class="title" href={w.href} data-sveltekit-reload={hit.thread.isChannel ? '' : undefined}>{w.label}</a>
                {#if w.channel && !hit.thread.isChannel}<a class="chan" href={channelHref(w.channel)}>{w.channel.icon ?? '#'} {channelLabel(w.channel)}</a>{/if}
                <span class="when" title={fullDate(hit.post.createdAt)}>{age(hit.post.createdAt)}</span>
              </div>
              <p class="text"><span class="who">{displayName(hit.post.author)}:</span> {@html snippet(hit.post.textContent, data.q)}</p>
            </div>
          </li>
        {/each}
      </ol>
      {#if data.cursor}<a class="more" href={more}>More results</a>{/if}
    {/if}
  {/if}
</div>

<style>
  .search { display: flex; gap: 8px; margin-bottom: 12px; }
  .search input { flex: 1; font: inherit; color: var(--text); background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 12px; }
  .search input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .narrow, .empty { color: var(--muted); font-size: 14px; }
  .hits { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
  .hits li { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .main { min-width: 0; flex: 1; }
  .top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .title { font-weight: 600; color: var(--text); }
  .chan, .when { font-size: 13px; color: var(--muted); }
  .when { margin-left: auto; }
  .text { margin: 2px 0 0; color: var(--text-2); font-size: 14px; overflow-wrap: anywhere; }
  .who { color: var(--muted); }
  .text :global(mark) { background: var(--accent-soft); color: var(--text); border-radius: 3px; padding: 0 1px; }
  .more { display: block; padding: 10px 0; color: var(--accent); font-size: 14px; }
</style>
