<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import Icon, { type IconName } from './Icon.svelte';
  import { drawer } from '$lib/nav.svelte';
  // The page's heading lives in the top bar, beside its controls: icon and
  // title, an optional sort pill, the description on one line (cut, with
  // "more" for the rest), then search and the page's action.
  let { icon, emoji, title, href, description, pills, actions }: {
    icon?: IconName; emoji?: string; title: string; href?: string; description?: string;
    pills?: Snippet; actions?: Snippet;
  } = $props();
  let desc: HTMLElement | undefined = $state();
  let clipped = $state(false);
  let open = $state(false);
  let query = $state('');
  let focused = $state(false);
  $effect(() => { query = page.url.pathname === '/search' ? page.url.searchParams.get('q') ?? '' : ''; });
  $effect(() => {
    if (!desc) return;
    const el = desc;
    // Measured a frame later: showing "more" narrows the text it measures.
    const ro = new ResizeObserver(() => requestAnimationFrame(() => (clipped = el.scrollWidth > el.clientWidth + 1)));
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<svelte:window onclick={(e) => { if (open && !(e.target as Element).closest('.top-desc')) open = false; }} />

<header class="top">
  <button class="menu-btn" aria-label="Open channels" onclick={() => (drawer.open = !drawer.open)}><Icon name="menu" /></button>
  <div class="top-title">
    <h1>
      {#if href}
        <a class="link" {href}>{#if emoji || icon}<span class="top-ico">{#if emoji}{emoji}{:else if icon}<Icon name={icon} />{/if}</span>{/if}{title}</a>
      {:else}
        {#if emoji || icon}<span class="top-ico">{#if emoji}{emoji}{:else if icon}<Icon name={icon} />{/if}</span>{/if}{title}
      {/if}
    </h1>
    {@render pills?.()}
    {#if description}
      <p class="top-desc">
        <span class="txt" bind:this={desc}>{description}</span>
        {#if clipped || open}<button class="more" aria-expanded={open} onclick={() => (open = !open)}>more</button>{/if}
        {#if open}<span class="desc-pop">{description}</span>{/if}
      </p>
    {/if}
  </div>
  <div class="top-right">
    <form class="search" class:wide={focused || query} method="GET" action="/search" role="search">
      <Icon name="search" />
      <input type="search" name="q" placeholder="Search" aria-label="Search posts" autocomplete="off" bind:value={query}
        onfocus={() => (focused = true)} onblur={() => (focused = false)} />
    </form>
    {@render actions?.()}
  </div>
</header>

<style>
  .top { flex: none; position: sticky; top: 0; z-index: 5; height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 20px;
    background: var(--bg); border-bottom: 1px solid var(--border); border-radius: 12px 12px 0 0; }
  .top-title { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 14px; }
  .top-title > :global(*) { flex: none; }
  h1 { font-size: 17px; line-height: 1.3; font-weight: 600; white-space: nowrap; display: inline-flex; align-items: center; min-width: 0; }
  h1, .link { display: inline-flex; align-items: center; gap: 6px; }
  .link:hover, .link:hover .top-ico { color: var(--accent-text); }
  .top-ico { color: var(--muted); display: inline-grid; place-items: center; width: 16px; font-size: 15px; }
  .top-title > .top-desc { flex: 0 1 auto; min-width: 0; position: relative; display: flex; align-items: baseline; gap: 6px; margin: 0;
    font-size: 13px; color: var(--muted); }
  .txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .more { flex: none; background: none; border: 0; padding: 0; font: inherit; color: var(--muted); cursor: pointer;
    text-decoration: underline; text-decoration-color: var(--border); text-underline-offset: 3px; }
  .more:hover { color: var(--text); text-decoration-color: currentColor; }
  .desc-pop { position: absolute; top: calc(100% + 10px); left: 0; z-index: 7; width: min(420px, 80vw); padding: 12px 14px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px var(--shadow);
    color: var(--text-2); font-size: 13.5px; line-height: 1.5; white-space: normal; text-wrap: pretty; }
  .top-right { flex: none; display: flex; align-items: center; gap: 8px; }
  .search { position: relative; width: 110px; transition: width .2s; }
  .search.wide { width: 220px; }
  .search :global(svg) { position: absolute; left: 10px; top: 8px; color: var(--muted); }
  .search input { width: 100%; height: 30px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text);
    padding: 0 10px 0 32px; font: inherit; font-size: 14px; }
  .menu-btn { display: none; width: 34px; height: 34px; flex: none; border-radius: 6px; border: 1px solid var(--border); background: var(--surface);
    place-items: center; cursor: pointer; color: var(--text-2); }
  @media (max-width: 820px) {
    .top { height: auto; min-height: 56px; flex-wrap: wrap; padding: 10px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px));
      border-radius: 0; }
    .menu-btn { display: grid; }
    .top-title { flex: 1 1 0; flex-wrap: wrap; row-gap: 2px; min-height: 36px; }
    .top-title > .top-desc { flex: 1 1 100%; order: 3; }
    .top-right { flex: 1 1 100%; order: 3; }
    .search, .search.wide { flex: 1; width: auto; }
  }
  @media (prefers-reduced-motion: reduce) { .search { transition: none; } }
</style>
