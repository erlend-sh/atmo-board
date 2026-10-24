<script lang="ts">
  import TopBar from '$lib/components/TopBar.svelte';
  import ThreadList from '$lib/components/ThreadList.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import JoinNotice from '$lib/components/JoinNotice.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { EVENT_TABS } from '$lib/directories';
  import { EVENTS, host, type ForumEvent } from '$lib/events';
  import { channelHref } from '$lib/names';
  import { latestPeople, recentlyActive } from '$lib/activity';
  let { data } = $props();
  let composing = $state(false);
  $effect(() => { data.tab; composing = false; });
  const tabs = $derived(EVENT_TABS.filter((t) => data.tabs.includes(t.id)));
  const ch = $derived(data.channel);
  const desc = $derived(ch ? ch.description ?? '' : 'Meetups, conferences and hackathons across the Atmosphere, gathered from Smoke Signal and OpenMeet.');

  // Upcoming events: this week first, then by month (with the year once it changes).
  const groups = $derived.by(() => {
    const now = Date.now(), year = new Date(now).getUTCFullYear();
    const out: [string, ForumEvent[]][] = [];
    for (const e of EVENTS.filter((e) => Date.parse(e.at) > now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      const t = Date.parse(e.at), d = new Date(t);
      const label = t - now < 7 * 86_400_000 ? 'This week'
        : d.toLocaleString('en', { month: 'long', timeZone: 'UTC', ...(d.getUTCFullYear() !== year ? { year: 'numeric' } : {}) });
      (out.find((g) => g[0] === label) ?? out[out.push([label, []]) - 1])[1].push(e);
    }
    return out;
  });
  const fmt = (e: ForumEvent, o: Intl.DateTimeFormatOptions) => new Date(e.at).toLocaleString('en', { timeZone: 'UTC', ...o });
</script>

<svelte:head><title>Events · {data.forum.name}</title></svelte:head>

<TopBar icon="calendar" title="events">
  {#snippet actions()}
    {#if ch && data.chat?.permissions.create}
      <button class="btn primary small" onclick={() => (composing = !composing)}>{composing ? 'Cancel' : 'New thread'}</button>
    {/if}
  {/snippet}
</TopBar>
<div class="ev-head">
  <nav class="tabs" aria-label="Events">
    {#each tabs as t (t.id)}
      <a href={t.id === 'upcoming' ? '/events' : `/events?tab=${t.id}`} class:on={t.id === data.tab} aria-current={t.id === data.tab ? 'page' : undefined}>{t.label}</a>
    {/each}
  </nav>
  {#if desc}<p class="desc">{desc}</p>{/if}
</div>

{#if ch && data.chat}
  <div class="board">
    <JoinNotice viewer={data.viewer} />
    {#if composing}
      <div class="new-thread"><Composer action="?/thread" title submit="Create thread" hidden={{ parent: ch.key }} placeholder="What's this thread about?" /></div>
    {/if}
    <ThreadList threads={data.threads} chat={{
      href: channelHref(ch, true), unread: !!data.viewer.did && data.chat.thread.postCount > (data.chat.thread.lastReadNumber ?? 0),
      active: recentlyActive(data.chat.posts), participants: latestPeople(data.chat.posts), lastActivityAt: data.chat.posts.at(-1)?.createdAt,
    }} />
  </div>
{:else}
  <div class="events">
    {#if groups.length === 0}<p class="empty">No upcoming events right now.</p>{/if}
    {#each groups as [label, events] (label)}
      <section>
        <h2>{label}</h2>
        <ol>
          {#each events as e (e.title + e.at)}
            <li class="ev">
              <div class="date"><span>{fmt(e, { month: 'short' })}</span><b>{new Date(e.at).getUTCDate()}</b><span>{fmt(e, { weekday: 'short' })}</span></div>
              <div class="main">
                <h3>{e.title}</h3>
                <div class="meta">
                  <span>{fmt(e, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} UTC</span>
                  <span><Icon name="pinMap" />{e.place}</span>
                  <span>{e.mode}</span>
                </div>
                <p>{e.description}</p>
                <div class="by"><Avatar author={host(e.by)} size={18} /><span>@{e.by}</span></div>
              </div>
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </div>
{/if}

<style>
  .ev-head { flex: none; padding: 18px 20px 6px var(--head-x); }
  .tabs { display: flex; align-items: center; gap: 22px; }
  .tabs a { font-size: 19px; font-weight: 600; line-height: 1.3; color: var(--muted); white-space: nowrap; }
  .tabs a:hover { color: var(--text); }
  .tabs a.on { color: var(--text); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 7px; text-decoration-color: var(--accent); }
  .desc { margin: 10px 0 0; font-size: 13px; color: var(--muted); max-width: 70ch; }
  .new-thread { padding: 0 0 16px; }
  .events { padding: 8px 20px 40px var(--head-x); }
  h2 { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 18px 0 8px; }
  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .ev { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 16px; align-items: start; padding: 14px 16px;
    border: 1px solid var(--border); border-radius: 10px; }
  .date { display: grid; justify-items: center; padding: 6px 0; border-radius: 8px; background: var(--surface-2); font-size: 11px;
    font-weight: 600; text-transform: uppercase; color: var(--muted); line-height: 1.2; }
  .date b { font-size: 20px; color: var(--text); line-height: 1.15; font-variant-numeric: tabular-nums; }
  .main { min-width: 0; display: grid; gap: 4px; }
  h3 { font-size: 15.5px; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--muted); }
  .meta span { display: inline-flex; align-items: center; gap: 4px; }
  p { margin: 2px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--text-2); text-wrap: pretty; }
  .by { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12.5px; color: var(--muted); }
  @media (max-width: 820px) {
    .ev-head { padding: 14px max(16px, env(safe-area-inset-right, 0px)) 4px max(16px, env(safe-area-inset-left, 0px)); }
    .tabs { gap: 16px; overflow-x: auto; scrollbar-width: none; padding-bottom: 8px; }
    .tabs a { font-size: 16px; }
    .events { padding: 4px max(16px, env(safe-area-inset-right, 0px)) 32px max(16px, env(safe-area-inset-left, 0px)); }
    .ev { grid-template-columns: 48px minmax(0, 1fr); gap: 12px; padding: 12px; }
  }
</style>
