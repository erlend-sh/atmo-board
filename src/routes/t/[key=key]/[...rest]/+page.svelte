<script lang="ts">
  import { tick } from 'svelte';
  import Post from '$lib/components/Post.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import NotifyMenu from '$lib/components/NotifyMenu.svelte';
  import ModMenu from '$lib/components/ModMenu.svelte';
  import { channelHref, threadHref } from '$lib/names';
  import { invalidate } from '$app/navigation';
  let { data } = $props();
  // The sidebar loaded alongside this page, before the read was recorded.
  $effect(() => { if (data.marked) invalidate('app:sidebar'); });
  const p = $derived(data.page);
  const t = $derived(p.thread);
  const base = $derived(threadHref(t));
  const first = $derived(p.posts[0]?.number ?? 1);
  const lastShown = $derived(p.posts.at(-1)?.number ?? 0);
  let replyTo = $state<{ key: string; number: number; name: string } | null>(null);
  let whisper = $state(false);

  $effect(() => {
    const n = data.target;
    if (!n) return;
    tick().then(() => document.getElementById(`post-${n}`)?.scrollIntoView({ block: 'start' }));
  });
</script>

<svelte:head><title>{t.title ?? 'Thread'} · {data.forum.name}</title></svelte:head>

<div class="page">
  <div class="crumbs">
    {#each p.ancestors as a (a.key)}<a href={threadHref(a)}>{a.isChannel ? `${p.channel?.icon ?? '#'} ${a.title}` : a.title}</a><span>›</span>{/each}
  </div>
  <div class="page-head">
    <div class="grow">
      <h1>
        {#if t.state.pinned}<span title="Pinned">📌</span>{/if}
        {#if t.state.hidden}<span title="Hidden from members">🚫</span>{/if}
        {#if t.state.locked}<span title="Locked">🔒</span>{/if}
        {t.title ?? 'Untitled'}
      </h1>
      {#if t.tags.length}<p>{#each t.tags as tag}<a class="tag" href="/tag/{tag}">{tag}</a> {/each}</p>{/if}
    </div>
    {#if p.permissions.curate || p.permissions.manage}
      <ModMenu thread={t} perms={p.permissions} channels={data.sections.flatMap((s) => s.channels)} />
    {/if}
    {#if data.viewer.did}<NotifyMenu thread={t.key} level={t.notificationLevel} />{/if}
  </div>
  <JoinNotice viewer={data.viewer} />

  {#if p.hasBefore}<a class="more" href="{base}/{Math.max(1, first - 1)}">Earlier posts</a>{/if}
  <section class="posts">
    {#each p.posts as post (post.key)}
      <div class="item" class:target={post.number === data.target}>
        <Post {post} threadHref={base} viewer={data.viewer.did} canReact={p.permissions.reply} perms={p.permissions}
          title={post.number === 1 ? t.title : undefined}
          deleteTo={post.number === 1 && p.channel ? channelHref(p.channel) : undefined}
          onreply={p.permissions.reply ? () => (replyTo = { key: post.number === 1 ? t.key : post.key, number: post.number, name: post.author.handle ?? 'post' }) : undefined} />
      </div>
    {/each}
  </section>
  {#if p.hasAfter}<a class="more" href="{base}/{lastShown + 1}">Later posts</a>{/if}

  {#if p.permissions.reply}
    <div class="dock">
      {#if replyTo}
        <p class="replying">Replying to #{replyTo.number} ({replyTo.name}) <button onclick={() => (replyTo = null)}>✕</button></p>
      {/if}
      <Composer action="?/reply" submit={whisper ? 'Whisper' : 'Reply'}
        placeholder={whisper ? 'Staff-only note on this thread. Only staff see it.' : 'Reply to this thread. Markdown works.'}
        hidden={{ ...(replyTo ? { replyTo: replyTo.key } : {}), ...(whisper ? { whisper: '1' } : {}) }}
        onposted={() => (replyTo = null)} />
      {#if p.permissions.moderate}
        <label class="whisper"><input type="checkbox" bind:checked={whisper} /> Whisper (staff only)</label>
      {/if}
    </div>
  {:else if t.state.locked}
    <p class="closed">This thread is locked.</p>
  {/if}
</div>
<Poller cursor={data.changeCursor} thread={t.key} />

<style>
  .posts { border-top: 1px solid var(--border); }
  .item { border-bottom: 1px solid var(--border); padding: 4px 0; }
  .item.target { background: linear-gradient(90deg, var(--accent-soft), transparent 60%); }
  .more { display: block; padding: 10px 0; color: var(--accent); font-size: 14px; }
  .tag { color: var(--muted); padding: 0 6px; border-radius: 4px; background: var(--surface-2); font-size: 13px; }
  .dock { position: sticky; bottom: 0; padding: 12px 0 16px; background: linear-gradient(transparent, var(--bg) 30%); }
  .replying { margin: 0 0 6px; font-size: 13px; color: var(--muted); }
  .replying button { background: none; border: 0; color: var(--muted); cursor: pointer; }
  .closed { color: var(--muted); padding: 16px 0; }
  .whisper { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--muted); font-size: 13px; }
</style>
