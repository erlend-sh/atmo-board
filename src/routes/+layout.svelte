<script lang="ts">
  import '$lib/styles/app.css';
  import { page } from '$app/state';
  import Avatar from '$lib/components/Avatar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { channelHref } from '$lib/names';
  import { DIRECTORIES, channelLabel, directory, eventTabOf, pinnedChannels, placeOf } from '$lib/directories';
  import { drawer } from '$lib/nav.svelte';
  import type { ChannelView } from '$lib/types';
  let { data, children } = $props();
  const channels = $derived(data.sections.flatMap((s) => s.channels));
  // The sidebar's only counter: unread threads, totalled on Index. Channels
  // (and unread chat) just turn bold.
  const total = $derived(channels.reduce((n, c) => n + (c.unreadCount ?? 0), 0));
  $effect(() => { page.url.pathname; drawer.open = false; });
  const me = $derived(data.viewer.did ? { did: data.viewer.did, handle: data.viewer.handle, roles: data.viewer.roles } : null);

  // The channel this page belongs to, and which sidebar page that files under.
  const path = $derived(page.url.pathname);
  const current = $derived(path.startsWith('/c/') ? channels.find((c) => c.key === page.params.key)
    : path.startsWith('/t/') ? (page.data as { page?: { channel?: ChannelView } }).page?.channel : undefined);
  const here = $derived(path === '/' ? 'index' : path === '/events' ? 'events' : page.params.dir ?? (current ? placeOf(current) : undefined));
  const evTab = $derived(path === '/events' ? page.url.searchParams.get('tab') : null);
  const isOn = (c: ChannelView) => c.key === current?.key || (!!evTab && eventTabOf(c) === evTab);
  const hrefOf = (c: ChannelView) => (eventTabOf(c) ? `/events?tab=${eventTabOf(c)}` : channelHref(c));

  const main = $derived(pinnedChannels(data.sections, data.viewer));
  const privates = $derived(data.sections.map((s) => ({ name: s.name, channels: s.channels.filter((c) => c.private && !placeOf(c)) })).filter((s) => s.channels.length));
  const placed = (id: string) => channels.filter((c) => placeOf(c) === id);
  const pages = $derived(DIRECTORIES.filter((d) => placed(d.id).length));
  const hasEvents = $derived(placed('events').length > 0);
  const opened = $derived(here && here !== 'index' && placed(here).length ? { id: here, label: here === 'events' ? 'Events' : directory(here)!.label, channels: placed(here) } : null);
  // On Index, "show all" opens every directory under MAIN. In a directory,
  // its section shows five channels and then "all".
  let showAll = $state(false);
  let dirAll = $state<string | null>(null);
  const visible = $derived(channels.length);
</script>

<svelte:head><title>{data.forum.name}</title></svelte:head>

{#snippet item(c: ChannelView)}
  <a class="nav-item" class:on={isOn(c)} class:unread={(c.unreadCount ?? 0) > 0 || c.unreadChat} href={hrefOf(c)}>
    <span class="ico">{#if c.icon}{c.icon}{:else}<Icon name={c.private ? 'lock' : 'hash'} />{/if}</span><span class="lbl">{channelLabel(c)}</span>
  </a>
{/snippet}

<div class="shell">
  <aside class:open={drawer.open}>
    <a class="side-head" href="/">
      <span class="logo" aria-hidden="true">{data.forum.name.slice(0, 1)}</span>
      <span class="forum"><b>{data.forum.name}</b><small>{page.url.host}</small></span>
    </a>
    <nav aria-label="Channels">
      <a class="nav-item" class:on={here === 'index'} href="/"><span class="ico"><Icon name="home" /></span><span class="lbl">Index</span>{#if total}<span class="count" title="{total} unread across all channels">{total}</span>{/if}</a>
      {#each pages as d (d.id)}
        <a class="nav-item" class:on={here === d.id} href="/{d.id}"><span class="ico"><Icon name={d.icon} /></span><span class="lbl">{d.label}</span></a>
      {/each}
      {#if hasEvents}
        <a class="nav-item" class:on={here === 'events'} href="/events"><span class="ico"><Icon name="calendar" /></span><span class="lbl">Events</span></a>
      {/if}
      {#if data.viewer.permissions.moderate}
        <a class="nav-item" class:on={path === '/review'} href="/review"><span class="ico"><Icon name="review" /></span><span class="lbl">Review</span></a>
        {#if data.viewer.permissions.admin}
          <a class="nav-item" class:on={path.startsWith('/admin')} href="/admin"><span class="ico"><Icon name="shield" /></span><span class="lbl">Admin</span></a>
        {/if}
      {/if}

      <h2 class="sec">Main</h2>
      {#each main.pinned as c (c.key)}{@render item(c)}{/each}
      {#if here === 'index'}
        {#if showAll}
          {#each main.rest as c (c.key)}{@render item(c)}{/each}
          {#each [...pages.map((d) => ({ id: d.id, label: d.label })), ...(hasEvents ? [{ id: 'events', label: 'Events' }] : [])] as d (d.id)}
            <h2 class="sec">{d.label}</h2>
            {#each placed(d.id) as c (c.key)}{@render item(c)}{/each}
          {/each}
        {/if}
        {#if visible > main.pinned.length}
          <button class="side-all" onclick={() => (showAll = !showAll)}>{showAll ? 'show fewer' : `show all ${visible} channels`}</button>
        {/if}
      {/if}
      {#each privates as s (s.name)}
        <h2 class="sec">{s.name || 'Private'}</h2>
        {#each s.channels as c (c.key)}{@render item(c)}{/each}
      {/each}
      {#if opened}
        {@const all = dirAll === opened.id}
        <h2 class="sec dir-sec"><span>{opened.label}</span></h2>
        {#each opened.channels.filter((c, i) => all || i < 5 || isOn(c)) as c (c.key)}{@render item(c)}{/each}
        {#if opened.channels.length > 5}
          <button class="side-all" onclick={() => (dirAll = all ? null : opened.id)}>{all ? 'fewer' : `all ${opened.channels.length}`}</button>
        {/if}
      {/if}
    </nav>
    <div class="me">
      {#if me}
        <Avatar author={me} size={32} />
        <span class="who"><b>{data.viewer.handle ?? data.viewer.did}</b><span>{data.viewer.roles.includes('admin') ? 'admin' : data.viewer.roles.includes('moderator') ? 'moderator' : data.viewer.member ? `trust level ${data.viewer.trustLevel ?? 0}` : 'not a member yet'}</span></span>
        <form method="POST" action="/logout"><button class="btn ghost small">Sign out</button></form>
      {:else}
        <a class="btn primary signin" href="/login?next={encodeURIComponent(path)}">Sign in</a>
      {/if}
    </div>
  </aside>
  {#if drawer.open}<button class="scrim" aria-label="Close channels" onclick={() => (drawer.open = false)}></button>{/if}
  <main>{@render children()}</main>
</div>

<style>
  /* Discourse's single-community shell with Discord's #channel sidebar. The
     content is a card on the sidebar's grey: rounded and boxed at the top,
     flowing straight down at the bottom. */
  .shell { display: grid; grid-template-columns: 268px minmax(0, 1fr); min-height: 100vh; padding-right: 8px; }
  aside { display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; background: var(--sidebar); }
  /* Its divider lines up with the top bar's: 8px shell padding + 1px card border + 56px bar. */
  .side-head { flex: none; height: 65px; padding: 8px 14px 0; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px; }
  .logo { width: 32px; height: 32px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 15px; }
  .forum { display: grid; min-width: 0; line-height: 1.2; }
  .forum b { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .forum small { font-size: 12px; color: var(--muted); }
  nav { flex: 1; overflow-y: auto; padding: 10px 8px 16px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 12px; color: var(--text-2);
    font-size: 14px; font-weight: 500; transition: background-color .15s; }
  .nav-item:hover { background: var(--hover); color: var(--text); }
  .nav-item.on { background: var(--accent-soft); color: var(--accent-text); }
  .nav-item.on .ico { color: var(--accent-text); }
  .nav-item.unread { color: var(--text); font-weight: 600; }
  .ico { width: 18px; display: grid; place-items: center; color: var(--muted); font-size: 14px; }
  .lbl { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sec { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 18px 12px 4px; }
  /* The open directory's section, underlined in the highlight's blue. */
  .dir-sec span { padding-bottom: 3px; border-bottom: 2px solid var(--accent-soft); }
  .side-all { display: block; margin: 2px 0 0 40px; padding: 2px 0; background: none; border: 0; font-size: 12px; color: var(--muted);
    cursor: pointer; text-decoration: underline; text-decoration-color: var(--border); text-underline-offset: 3px; }
  .side-all:hover { color: var(--text); text-decoration-color: currentColor; }
  .me { margin: 8px; padding: 9px 10px; display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: 10px;
    background: color-mix(in srgb, var(--sidebar) 45%, var(--bg)); }
  .who { flex: 1; min-width: 0; display: grid; line-height: 1.25; }
  .who b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who span { font-size: 12px; color: var(--muted); }
  .signin { flex: 1; justify-content: center; }
  main { min-width: 0; margin-top: 8px; display: flex; flex-direction: column; background: var(--bg); border: 1px solid var(--border); border-bottom: 0;
    border-radius: 12px 12px 0 0; --head-x: 42px; }
  .scrim { display: none; }
  @media (max-width: 820px) {
    .shell { grid-template-columns: minmax(0, 1fr); padding-right: 0; }
    aside { position: fixed; inset: 0 auto 0 0; width: min(300px, 86vw); height: auto; z-index: 40; transform: translateX(-105%);
      transition: transform .2s; padding-top: env(safe-area-inset-top, 0px); }
    aside.open { transform: none; box-shadow: 0 0 50px rgb(0 0 0 / .35); }
    .side-head { height: 57px; padding-top: 0; }
    .me { margin-bottom: calc(8px + env(safe-area-inset-bottom, 0px)); }
    .scrim { display: block; position: fixed; inset: 0; z-index: 39; border: 0; background: rgb(0 0 0 / .3); }
    main { margin-top: 0; border: 0; border-radius: 0; --head-x: 16px; }
  }
  @media (prefers-reduced-motion: reduce) { aside, .nav-item { transition: none; } }
</style>
