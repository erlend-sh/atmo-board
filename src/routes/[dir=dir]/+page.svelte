<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import TopBar from '$lib/components/TopBar.svelte';
  import SortPills from '$lib/components/SortPills.svelte';
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { directory } from '$lib/directories';
  import { channelHref } from '$lib/names';
  let { data } = $props();
  const dir = $derived(directory(data.dir)!);
  let composing = $state(false);
  const following = (verb: string) => (verb === 'Join' ? 'Joined' : 'Following');
</script>

<svelte:head><title>{dir.label} · {data.forum.name}</title></svelte:head>

<TopBar icon={dir.icon} title={dir.label.toLowerCase()} description={dir.description}>
  {#snippet pills()}
    <SortPills options={['overview', 'latest', 'unread', 'top']} current={data.sort}
      href={(s) => (s === 'overview' ? `/${dir.id}` : `/${dir.id}?sort=${s}`)} />
  {/snippet}
  {#snippet actions()}
    {#if dir.create && data.viewer.permissions.create}
      <button class="btn primary small" onclick={() => (composing = !composing)}>{composing ? 'Cancel' : dir.create.label}</button>
    {/if}
  {/snippet}
</TopBar>

{#if composing && dir.create}
  <div class="cards compose">
    <Composer action="?/thread" title titleHint="{dir.create.noun[0].toUpperCase()}{dir.create.noun.slice(1)} name" submit="Create {dir.create.noun}"
      channels={data.channels} placeholder="What's this {dir.create.noun} about?" />
  </div>
{/if}

{#if data.sort === 'overview'}
  <div class="cards">
    <JoinNotice viewer={data.viewer} />
    <ul class="grid" class:compact={!!dir.create}>
      {#each data.channels as c (c.key)}
        {@const on = c.level === 'watching'}
        <li class="card">
          <a class="title" href={channelHref(c)}>{c.title}</a>
          <p>{c.description ?? ''}</p>
          <div class="foot">
            <span><Icon name="chat" size={dir.create ? 13 : 16} />{c.threadCount ?? 0} {c.threadCount === 1 ? 'thread' : 'threads'}</span>
            {#if data.viewer.did}
              <form method="POST" action="?/notify" use:enhance={() => async ({ update }) => { await update({ reset: false }); invalidate('app:sidebar'); }}>
                <input type="hidden" name="thread" value={c.key} />
                <input type="hidden" name="level" value={on ? 'normal' : 'watching'} />
                <button class="btn small" class:on title={on ? `Stop watching ${c.title}` : `Watch ${c.title}: every new post notifies you`}>
                  {#if on}<Icon name="bell" size={13} />{following(dir.follow)}{:else}{dir.follow}{/if}
                </button>
              </form>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>
{:else}
  <div class="board">
    <JoinNotice viewer={data.viewer} />
    <ThreadList threads={data.threads} channels={data.index}
      empty={data.sort === 'unread' ? "You're all caught up." : `No threads in ${dir.label.toLowerCase()} yet.`} />
  </div>
{/if}

<style>
  .cards { padding: 20px 20px 40px var(--head-x); }
  .compose { padding-bottom: 0; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .card { display: flex; flex-direction: column; gap: 8px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }
  .title { align-self: flex-start; font-size: 16px; font-weight: 600; line-height: 1.3; color: var(--text); }
  .title:hover { color: var(--accent-text); }
  p { margin: 0; flex: 1; font-size: 13.5px; line-height: 1.5; color: var(--muted); text-wrap: pretty; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; padding-top: 12px;
    border-top: 1px solid var(--border); font-size: 13px; color: var(--muted); }
  .foot span { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
  .btn.on { background: var(--accent-soft); border-color: transparent; color: var(--accent-text); gap: 5px; }
  /* Projects: smaller cards, three lines of description. */
  .compact { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
  .compact .card { gap: 4px; padding: 12px 12px 10px; border-radius: 8px; }
  .compact .title { font-size: 14.5px; }
  .compact p { flex: none; margin-bottom: auto; font-size: 12.5px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3;
    -webkit-box-orient: vertical; overflow: hidden; }
  .compact .foot { margin-top: 4px; padding-top: 8px; font-size: 12px; }
  .compact .foot .btn { height: 26px; padding: 0 10px; font-size: 12.5px; }
  @media (max-width: 820px) {
    .cards { padding: 16px max(16px, env(safe-area-inset-right, 0px)) 32px max(16px, env(safe-area-inset-left, 0px)); }
  }
</style>
