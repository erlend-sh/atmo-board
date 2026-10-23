<script lang="ts">
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  let { data } = $props();
</script>

<div class="page">
  <div class="page-head">
    <div class="grow">
      <h1>{data.forum.name}</h1>
      {#if data.forum.description}<p>{data.forum.description}</p>{/if}
    </div>
  </div>
  <JoinNotice viewer={data.viewer} />
  <nav class="tabs">
    <a href="/" class:active={data.sort === 'latest'}>Latest</a>
    <a href="/?sort=new" class:active={data.sort === 'new'}>New</a>
    <a href="/?sort=top" class:active={data.sort === 'top'}>Top</a>
  </nav>
  <ThreadList threads={data.threads} channels={data.channels} />
</div>
<Poller cursor={data.changeCursor} />
