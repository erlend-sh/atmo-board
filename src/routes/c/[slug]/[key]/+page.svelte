<script lang="ts">
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Post from '$lib/components/Post.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import { grouped } from '$lib/grouping';
  import { invalidate } from '$app/navigation';
  let { data } = $props();
  // The sidebar loaded alongside this page, before the read was recorded.
  $effect(() => { if (data.marked) invalidate('app:sidebar'); });
  const ch = $derived(data.chat.channel);
  const t = $derived(data.chat.thread);
  const base = $derived(`/c/${t.slug}/${t.key}`);
  let composing = $state(false);
  let chatEnd: HTMLElement | undefined = $state();
  $effect(() => { data.chat.posts.length; if (data.view === 'chat') chatEnd?.scrollIntoView({ block: 'end' }); });
</script>

<svelte:head><title>#{ch?.title ?? t.title} · {data.forum.name}</title></svelte:head>

<div class="page">
  <div class="page-head">
    <div class="grow">
      <h1>{ch?.icon ?? '#'} {ch?.title ?? t.title}</h1>
      {#if ch?.description}<p>{ch.description}</p>{/if}
    </div>
    {#if data.chat.permissions.create && data.view === 'threads'}
      <button class="btn primary" onclick={() => (composing = !composing)}>{composing ? 'Cancel' : 'New thread'}</button>
    {/if}
  </div>
  <JoinNotice viewer={data.viewer} />

  <nav class="tabs">
    <a href={base} class:active={data.view === 'threads'}>Threads</a>
    <a href="{base}?view=chat" class:active={data.view === 'chat'}>Chat{#if ch?.unreadCount && data.view !== 'chat'} · {ch.unreadCount}{/if}</a>
  </nav>

  {#if data.view === 'threads'}
    {#if composing}
      <div class="new-thread"><Composer action="?/thread" title submit="Create thread" placeholder="What's this thread about? Markdown works." /></div>
    {/if}
    <ThreadList threads={data.threads} />
  {:else}
    <section class="chat">
      {#if data.chat.hasBefore}<p class="more">Showing the latest {data.chat.posts.length} messages.</p>{/if}
      {#if data.chat.posts.length === 0}<p class="empty">No messages yet. Say hello.</p>{/if}
      {#each grouped(data.chat.posts) as { post, compact } (post.key)}
        <Post {post} {compact} threadHref={base} />
      {/each}
      <div bind:this={chatEnd}></div>
    </section>
    {#if data.chat.permissions.reply}
      <div class="dock"><Composer action="?/chat" placeholder="Message #{ch?.title ?? ''}" /></div>
    {/if}
  {/if}
</div>
<Poller cursor={data.changeCursor} parent={t.key} />

<style>
  .new-thread { padding: 12px 0 16px; border-bottom: 1px solid var(--border); }
  .chat { padding-bottom: 8px; }
  .more, .empty { color: var(--muted); font-size: 14px; }
  .dock { position: sticky; bottom: 0; padding: 12px 0 16px; background: linear-gradient(transparent, var(--bg) 30%); }
</style>
