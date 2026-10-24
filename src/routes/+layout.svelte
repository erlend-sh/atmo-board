<script lang="ts">
  import '$lib/styles/app.css';
  import { page } from '$app/state';
  import Avatar from '$lib/components/Avatar.svelte';
  import { channelHref } from '$lib/names';
  let { data, children } = $props();
  let open = $state(false);
  const current = $derived(page.params.key);
  // The sidebar's only counter: unread threads, totalled on Latest. Channels
  // (and unread chat) just turn bold.
  const total = $derived(data.sections.reduce((n, s) => n + s.channels.reduce((m, c) => m + (c.unreadCount ?? 0), 0), 0));
  $effect(() => { page.url.pathname; open = false; });
  const me = $derived(data.viewer.did ? { did: data.viewer.did, handle: data.viewer.handle, roles: data.viewer.roles } : null);
</script>

<svelte:head><title>{data.forum.name}</title></svelte:head>

<div class="shell">
  <aside class:open>
    <a class="forum" href="/">{data.forum.name}</a>
    <form class="find" method="GET" action="/search" role="search">
      <input type="search" name="q" placeholder="Search" aria-label="Search the forum" value={page.url.pathname === '/search' ? page.url.searchParams.get('q') ?? '' : ''} />
    </form>
    <nav>
      <a class="link" class:active={page.url.pathname === '/'} href="/"><span class="name">Latest</span>{#if total}<span class="badge">{total}</span>{/if}</a>
      {#each data.sections as section}
        {#if section.name}<h2>{section.name}</h2>{/if}
        {#each section.channels as ch (ch.key)}
          <a class="channel" class:active={current === ch.key} class:unread={(ch.unreadCount ?? 0) > 0 || ch.unreadChat} href={channelHref(ch)}>
            <span class="hash">{ch.icon ?? '#'}</span><span class="name">{ch.title}</span>
          </a>
        {/each}
      {/each}
    </nav>
    <div class="me">
      {#if me}
        <Avatar author={me} size={28} />
        <span class="who">{data.viewer.handle ?? data.viewer.did}</span>
        <form method="POST" action="/logout"><button class="link-btn">Sign out</button></form>
      {:else}
        <a class="btn primary" href="/login">Sign in</a>
      {/if}
    </div>
  </aside>
  <button class="menu" aria-label="Channels" onclick={() => (open = !open)}>☰</button>
  <main>{@render children()}</main>
</div>

<style>
  .shell { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
  aside { background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .forum { display: block; padding: 18px 16px 12px; font-weight: 700; font-size: 17px; }
  .find { padding: 0 8px 4px; }
  .find input { width: 100%; font: inherit; font-size: 14px; color: var(--text); background: var(--surface-2);
    border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; }
  .find input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  nav { flex: 1; padding: 0 8px 16px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 16px 8px 4px; }
  .link, .channel { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; color: var(--text-2); }
  .link { font-weight: 600; margin-top: 4px; }
  .channel:hover, .link:hover { background: var(--surface-2); text-decoration: none; }
  .active { background: var(--surface-2); color: var(--text); }
  .channel.unread { color: var(--text); font-weight: 600; }
  .hash { width: 18px; text-align: center; color: var(--muted); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { background: var(--accent); color: var(--on-accent); border-radius: 10px; padding: 0 7px; font-size: 12px; font-weight: 700; }
  .me { display: flex; align-items: center; gap: 8px; padding: 12px; border-top: 1px solid var(--border); }
  .who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  .link-btn { background: none; border: 0; color: var(--muted); font: inherit; font-size: 13px; cursor: pointer; padding: 0; }
  main { min-width: 0; }
  .menu { display: none; }
  @media (max-width: 800px) {
    .shell { grid-template-columns: 1fr; }
    aside { position: fixed; inset: 0 auto 0 0; width: 280px; z-index: 20; transform: translateX(-100%); transition: transform .2s; }
    aside.open { transform: none; box-shadow: 0 0 40px rgb(0 0 0 / .3); }
    .menu { display: block; position: fixed; top: 10px; left: 10px; z-index: 30; width: 38px; height: 38px;
      border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 18px; }
  }
</style>
