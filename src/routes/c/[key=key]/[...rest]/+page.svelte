<script lang="ts">
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Post from '$lib/components/Post.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import NotifyMenu from '$lib/components/NotifyMenu.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import { grouped } from '$lib/grouping';
  import { channelHref } from '$lib/names';
  import { channelLabel } from '$lib/directories';
  import { latestPeople, recentlyActive } from '$lib/activity';
  import { invalidate } from '$app/navigation';
  let { data } = $props();
  // The sidebar loaded alongside this page, before the read was recorded.
  $effect(() => { if (data.marked) invalidate('app:sidebar'); });
  const ch = $derived(data.chat.channel);
  const t = $derived(data.chat.thread);
  const base = $derived(channelHref(t));
  const name = $derived(channelLabel(ch ?? { title: t.title ?? '' }));
  const chatUnread = $derived(!!data.viewer.did && t.postCount > (t.lastReadNumber ?? 0));
  let composing = $state(false);
  let whisper = $state(false);
  let chatEnd: HTMLElement | undefined = $state();
  $effect(() => { data.chat.posts.length; if (data.view === 'chat') chatEnd?.scrollIntoView({ block: 'end' }); });
</script>

<svelte:head><title>{ch?.title ?? t.title}{data.view === 'chat' ? '/chat' : ''} · {data.forum.name}</title></svelte:head>

{#if data.view === 'chat'}
  <TopBar icon="chat" title="{name}/chat" href={base}>
    {#snippet actions()}{#if data.viewer.did}<NotifyMenu thread={t.key} level={t.notificationLevel} channel />{/if}{/snippet}
  </TopBar>
  <div class="page">
    <JoinNotice viewer={data.viewer} />
    <section class="chat">
      {#if data.chat.hasBefore}<p class="more">Showing the latest {data.chat.posts.length} messages.</p>{/if}
      {#if data.chat.posts.length === 0}<p class="empty">No messages yet. Say hello.</p>{/if}
      {#each grouped(data.chat.posts) as { post, compact } (post.key)}
        <Post {post} {compact} threadHref={base} viewer={data.viewer.did}
          canReact={data.chat.permissions.reply} perms={data.chat.permissions} />
      {/each}
      <div bind:this={chatEnd}></div>
    </section>
    {#if data.chat.permissions.reply}
      <div class="dock">
        <Composer action="?/chat" submit={whisper ? 'Whisper' : 'Send'}
          placeholder={whisper ? 'Staff-only note in this chat' : `Message ${name}/chat`}
          hidden={whisper ? { whisper: '1' } : {}} />
        {#if data.chat.permissions.moderate}
          <label class="whisper"><input type="checkbox" bind:checked={whisper} /> Whisper (staff only)</label>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <TopBar icon={ch?.private ? 'lock' : 'hash'} emoji={ch?.icon} title={name} description={ch?.description}>
    {#snippet actions()}
      {#if data.viewer.did}<NotifyMenu thread={t.key} level={t.notificationLevel} channel />{/if}
      {#if data.chat.permissions.create}
        <button class="btn primary small" onclick={() => (composing = !composing)}>{composing ? 'Cancel' : 'New thread'}</button>
      {/if}
    {/snippet}
  </TopBar>
  <div class="board">
    <JoinNotice viewer={data.viewer} />
    {#if composing}
      <div class="new-thread"><Composer action="?/thread" title submit="Create thread" placeholder="What's this thread about?" /></div>
    {/if}
    <ThreadList threads={data.threads} chat={{
      href: channelHref(t, true), unread: chatUnread, active: recentlyActive(data.chat.posts),
      participants: latestPeople(data.chat.posts), lastActivityAt: data.chat.posts.at(-1)?.createdAt,
    }} />
  </div>
{/if}
<Poller cursor={data.changeCursor} parent={t.key} />

<style>
  .new-thread { padding: 0 0 16px; }
  .chat { padding-bottom: 8px; }
  .more { color: var(--muted); font-size: 14px; }
  .whisper { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--muted); font-size: 13px; }
  .dock { position: sticky; bottom: 0; padding: 12px 0 18px; background: linear-gradient(transparent, var(--bg) 26%); }
</style>
