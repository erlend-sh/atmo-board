<script lang="ts">
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  let { data } = $props();
</script>

<div class="page">
  <div class="page-head">
    <div class="grow">
      <div class="title-row">
        <h1>{data.forum.name}</h1>
        <nav class="pills" aria-label="Sort threads">
          <a href="/" class:active={data.sort === 'latest'}>Latest</a>
          <a href="/?sort=unread" class:active={data.sort === 'unread'}>Unread</a>
          <a href="/?sort=top" class:active={data.sort === 'top'}>Top</a>
        </nav>
      </div>
      {#if data.forum.description}<p>{data.forum.description}</p>{/if}
    </div>
  </div>
  <JoinNotice viewer={data.viewer} />
  <ThreadList threads={data.threads} channels={data.channels}
    empty={data.sort === 'unread' ? (data.viewer.did ? "You're all caught up." : 'Sign in to keep track of what you have read.') : undefined} />
</div>
<Poller cursor={data.changeCursor} />
