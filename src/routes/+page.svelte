<script lang="ts">
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import SortPills from '$lib/components/SortPills.svelte';
  import Composer from '$lib/components/Composer.svelte';
  let { data } = $props();
  let composing = $state(false);
  const pickable = $derived(data.sections.flatMap((s) => s.channels));
</script>

<TopBar icon="home" title="index" description={data.forum.description}>
  {#snippet pills()}
    <SortPills options={['latest', 'unread', 'top']} current={data.sort} href={(s) => (s === 'latest' ? '/' : `/?sort=${s}`)} />
  {/snippet}
  {#snippet actions()}
    {#if data.viewer.permissions.create}
      <button class="btn primary small" onclick={() => (composing = !composing)}>{composing ? 'Cancel' : 'New thread'}</button>
    {/if}
  {/snippet}
</TopBar>
<div class="board">
  <JoinNotice viewer={data.viewer} />
  {#if composing}
    <div class="new-thread"><Composer action="?/thread" title submit="Create thread" channels={pickable} placeholder="What's this thread about?" /></div>
  {/if}
  <ThreadList threads={data.threads} channels={data.channels}
    empty={data.sort === 'unread' ? (data.viewer.did ? "You're all caught up." : 'Sign in to keep track of what you have read.') : undefined} />
</div>
<Poller cursor={data.changeCursor} />

<style>
  .new-thread { padding: 0 0 16px; }
</style>
