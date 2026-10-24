<script lang="ts">
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Post from '$lib/components/Post.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import NotifyMenu from '$lib/components/NotifyMenu.svelte';
  import { grouped } from '$lib/grouping';
  import { channelHref } from '$lib/names';
  import { invalidate } from '$app/navigation';
  let { data } = $props();
  // The sidebar loaded alongside this page, before the read was recorded.
  $effect(() => { if (data.marked) invalidate('app:sidebar'); });
  const ch = $derived(data.chat.channel);
  const t = $derived(data.chat.thread);
  const base = $derived(channelHref(t));
  const chatUnread = $derived(!!data.viewer.did && t.postCount > (t.lastReadNumber ?? 0));
  // Most recent chat posters first, for the chat row's participants.
  const chatPeople = $derived([...new Map(data.chat.posts.toReversed().map((p) => [p.author.did, p.author])).values()].slice(0, 5));
  let composing = $state(false);
  let chatEnd: HTMLElement | undefined = $state();
  $effect(() => { data.chat.posts.length; if (data.view === 'chat') chatEnd?.scrollIntoView({ block: 'end' }); });
</script>

<svelte:head><title>{ch?.title ?? t.title}{data.view === 'chat' ? '/chat' : ''} · {data.forum.name}</title></svelte:head>

<div class="page">
  {#if data.view === 'chat'}
    <div class="crumbs"><a href={base}>{ch?.icon ?? '#'} {ch?.title ?? t.title}</a></div>
  {/if}
  <div class="page-head">
    <div class="grow">
      {#if data.view === 'chat'}
        <h1>💬 {ch?.title ?? t.title}/chat</h1>
      {:else}
        <h1>{ch?.icon ?? '#'} {ch?.title ?? t.title}</h1>
        {#if ch?.description}<p>{ch.description}</p>{/if}
      {/if}
    </div>
    {#if data.viewer.did}<NotifyMenu thread={t.key} level={t.notificationLevel} channel />{/if}
    {#if data.chat.permissions.create && data.view === 'threads'}
      <button class="btn primary" onclick={() => (composing = !composing)}>{composing ? 'Cancel' : 'New thread'}</button>
    {/if}
  </div>
  <JoinNotice viewer={data.viewer} />


  {#if data.view === 'threads'}
    {#if composing}
      <div class="new-thread"><Composer action="?/thread" title submit="Create thread" placeholder="What's this thread about? Markdown works." /></div>
    {/if}
    <ThreadList threads={data.threads} chat={{
      href: channelHref(t, true), title: `${ch?.title ?? t.title}/chat`, unread: chatUnread,
      participants: chatPeople, lastActivityAt: data.chat.posts.at(-1)?.createdAt,
    }} />
  {:else}
    <section class="chat">
      {#if data.chat.hasBefore}<p class="more">Showing the latest {data.chat.posts.length} messages.</p>{/if}
      {#if data.chat.posts.length === 0}<p class="empty">No messages yet. Say hello.</p>{/if}
      {#each grouped(data.chat.posts) as { post, compact } (post.key)}
        <Post {post} {compact} threadHref={base} viewer={data.viewer.did} canReact={data.chat.permissions.reply} />
      {/each}
      <div bind:this={chatEnd}></div>
    </section>
    {#if data.chat.permissions.reply}
      <div class="dock"><Composer action="?/chat" placeholder="Message {ch?.title ?? ''}/chat" /></div>
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
