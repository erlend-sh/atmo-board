<script lang="ts">
  import { tick } from 'svelte';
  import Post from '$lib/components/Post.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import Poller from '$lib/components/Poller.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import NotifyMenu from '$lib/components/NotifyMenu.svelte';
  import ModMenu from '$lib/components/ModMenu.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { channelHref, threadHref } from '$lib/names';
  import { channelLabel } from '$lib/directories';
  import { age, fullDate } from '$lib/time';
  import { invalidate } from '$app/navigation';
  let { data } = $props();
  // The sidebar loaded alongside this page, before the read was recorded.
  $effect(() => { if (data.marked) invalidate('app:sidebar'); });
  const p = $derived(data.page);
  const t = $derived(p.thread);
  const base = $derived(threadHref(t));
  const first = $derived(p.posts[0]?.number ?? 1);
  const lastShown = $derived(p.posts.at(-1)?.number ?? 0);
  const parent = $derived(p.ancestors.at(-1));
  let replyTo = $state<{ key: string; number: number; name: string } | null>(null);
  let whisper = $state(false);
  // The reply box sits at the end of the thread until a reply starts: typing,
  // Reply, or replying to a post makes it sticky.
  let docked = $state(false);
  let box: HTMLTextAreaElement | undefined = $state();
  const startReply = async () => { docked = true; await tick(); box?.focus(); };

  // The timeline rail: where the reader is, out of every post.
  const pos = $derived(Math.min(data.target ?? lastShown, t.postCount));
  const knob = $derived(Math.round(((pos - 1) / Math.max(1, t.postCount - 1)) * 174));
  const ago = (iso?: string) => { const a = age(iso); return /^\d/.test(a) ? `${a} ago` : a; };

  $effect(() => {
    const n = data.target;
    if (!n) return;
    tick().then(() => document.getElementById(`post-${n}`)?.scrollIntoView({ block: 'start' }));
  });
</script>

<svelte:head><title>{t.title ?? 'Thread'} · {data.forum.name}</title></svelte:head>

{#if parent}
  <TopBar icon={p.channel?.private ? 'lock' : 'hash'} emoji={parent.isChannel ? p.channel?.icon : undefined}
    title={parent.isChannel ? channelLabel(p.channel ?? { title: parent.title ?? '' }) : parent.title ?? 'Thread'} href={threadHref(parent)} />
{:else}
  <TopBar icon="hash" title={t.title ?? 'Thread'} />
{/if}
<div class="page wide">
  <div class="grid">
    <div class="content">
      {#if p.ancestors.length > 1}
        <div class="crumbs">{#each p.ancestors as a (a.key)}<a href={threadHref(a)}>{a.isChannel ? channelLabel(p.channel ?? { title: a.title ?? '' }) : a.title}</a><span>›</span>{/each}</div>
      {/if}
      <div class="head">
        <div class="grow">
          <h1>{t.title ?? 'Untitled'}</h1>
          {#if t.tags.length || t.state.pinned || t.state.locked || t.state.hidden}
            <p class="flags">
              {#each t.tags as tag}<a class="tag" href="/search?q={encodeURIComponent(tag)}">{tag}</a>{/each}
              {#if t.state.pinned}<span class="pill"><Icon name="pin" /> pinned</span>{/if}
              {#if t.state.locked}<span class="pill"><Icon name="lock" size={12} /> locked</span>{/if}
              {#if t.state.hidden}<span class="pill">hidden from members</span>{/if}
            </p>
          {/if}
        </div>
        {#if p.permissions.curate || p.permissions.manage}
          <ModMenu thread={t} perms={p.permissions} channels={data.sections.flatMap((s) => s.channels)} />
        {/if}
        {#if data.viewer.did}<div class="head-notify"><NotifyMenu thread={t.key} level={t.notificationLevel} /></div>{/if}
      </div>
      <JoinNotice viewer={data.viewer} />

      {#if p.hasBefore}<a class="more" href="{base}/{Math.max(1, first - 1)}">Earlier posts</a>{/if}
      <section class="posts" aria-label="Posts">
        {#each p.posts as post (post.key)}
          <div class="item" class:target={post.number === data.target}>
            <Post {post} threadHref={base} viewer={data.viewer.did} canReact={p.permissions.reply} perms={p.permissions}
              title={post.number === 1 ? t.title : undefined}
              deleteTo={post.number === 1 && p.channel ? channelHref(p.channel) : undefined}
              onreply={p.permissions.reply ? () => { replyTo = { key: post.number === 1 ? t.key : post.key, number: post.number, name: post.author.handle ?? 'post' }; startReply(); } : undefined} />
          </div>
        {/each}
      </section>
      {#if p.hasAfter}<a class="more" href="{base}/{lastShown + 1}">Later posts</a>{/if}

      {#if p.permissions.reply}
        <div class="dock" class:docked>
          <Composer action="?/reply" submit={whisper ? 'Whisper' : 'Reply'} bind:textarea={box} onactive={() => (docked = true)}
            placeholder={whisper ? 'Staff-only note on this thread. Only staff see it.' : 'Reply to this thread'}
            hidden={{ ...(replyTo ? { replyTo: replyTo.key } : {}), ...(whisper ? { whisper: '1' } : {}) }}
            onposted={() => { replyTo = null; docked = false; }}>
            {#snippet above()}
              {#if replyTo}<p class="replying">↩ Replying to #{replyTo.number} {replyTo.name} <button type="button" aria-label="Cancel" onclick={() => (replyTo = null)}>✕</button></p>{/if}
            {/snippet}
          </Composer>
          {#if p.permissions.moderate}
            <label class="whisper"><input type="checkbox" bind:checked={whisper} /> Whisper (staff only)</label>
          {/if}
        </div>
      {:else if t.state.locked}
        <p class="closed"><Icon name="lock" /> This thread is locked.</p>
      {/if}
    </div>

    <aside class="rail" aria-label="Timeline">
      <a href="{base}/1" title={fullDate(t.createdAt)}>{ago(t.createdAt)}</a>
      <div class="track">
        <span class="knob" style:top="{knob}px"></span>
        <span class="pos" style:top="{knob + 14}px">{pos} / {t.postCount}</span>
      </div>
      <a href="{base}/last" title={fullDate(t.lastActivityAt)}>{ago(t.lastActivityAt)}</a>
      {#if data.viewer.did}
        <div class="rail-actions">
          {#if p.permissions.reply}<button class="btn small reply" onclick={startReply}><Icon name="replyArrow" />Reply</button>{/if}
          <NotifyMenu thread={t.key} level={t.notificationLevel} />
        </div>
      {/if}
    </aside>
  </div>
</div>
<Poller cursor={data.changeCursor} thread={t.key} />

<style>
  .wide { max-width: 1200px; }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) 128px; gap: 48px; }
  .head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
  .grow { flex: 1; min-width: 0; }
  h1 { font-size: 26px; font-weight: 600; letter-spacing: -.01em; text-wrap: balance; overflow-wrap: anywhere; }
  .flags { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0 0; }
  .tag, .pill { font-size: 11px; font-weight: 500; letter-spacing: .03em; padding: 2px 7px; border-radius: 999px; background: var(--surface-2);
    color: var(--muted); display: inline-flex; gap: 4px; align-items: center; }
  .posts { border-top: 1px solid var(--border); }
  .item { border-bottom: 1px solid var(--border); padding: 6px 0; }
  .item.target { background: linear-gradient(90deg, var(--accent-soft), transparent 70%); border-radius: 6px; }
  .more { display: block; padding: 10px 0; color: var(--accent); font-size: 14px; }
  .dock { padding: 12px 0 18px; }
  .dock.docked { position: sticky; bottom: 0; background: linear-gradient(transparent, var(--bg) 26%); }
  .replying { margin: 0; padding: 0 8px; font-size: 13px; color: var(--muted); display: flex; gap: 8px; align-items: center; }
  .replying button { background: none; border: 0; color: var(--muted); cursor: pointer; }
  .closed { color: var(--muted); padding: 16px 0; display: flex; gap: 8px; align-items: center; }
  .whisper { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--muted); font-size: 13px; }
  /* The rail, far right: first and last dates, where you are, Reply and notifications. */
  .rail { position: sticky; top: 76px; align-self: start; padding-top: 6px; font-size: 13px; color: var(--muted); }
  .rail > a { display: block; }
  .rail > a:hover { color: var(--text); }
  .track { position: relative; height: 220px; border-left: 2px solid var(--border); margin: 10px 0 10px 6px; }
  .knob { position: absolute; left: -5px; width: 8px; height: 46px; border-radius: 4px; background: var(--accent); }
  .pos { position: absolute; left: 14px; color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rail-actions { display: inline-grid; gap: 6px; margin-top: 18px; }
  .rail-actions :global(.btn) { justify-content: flex-start; gap: 6px; height: 28px; padding: 0 10px; width: 100%; }
  .rail-actions .reply { background: var(--accent-soft); border-color: transparent; color: var(--accent-text); }
  .rail-actions .reply:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  /* Without the rail, notifications move up beside the title. */
  .head-notify { display: none; }
  @media (max-width: 1100px) {
    .grid { grid-template-columns: minmax(0, 1fr); }
    .rail { display: none; }
    .head-notify { display: block; }
  }
</style>
