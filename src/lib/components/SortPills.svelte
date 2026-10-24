<script lang="ts">
  // The sort choice, collapsed to the current one; the others slide out on
  // hover or focus.
  let { options, current, href }: { options: string[]; current: string; href: (sort: string) => string } = $props();
</script>

<nav class="pills collapse" aria-label="Sort threads">
  {#each options as o (o)}
    <a href={href(o)} class:on={o === current} aria-current={o === current ? 'page' : undefined}>{o[0].toUpperCase() + o.slice(1)}</a>
  {/each}
</nav>

<style>
  .collapse { gap: 0; }
  .collapse a { white-space: nowrap; max-width: 120px; transition: max-width .2s, padding .2s, opacity .15s, margin .2s; }
  .collapse a + a { margin-left: 2px; }
  .collapse:not(:hover):not(:focus-within) a:not(.on) { max-width: 0; padding-inline: 0; margin-left: 0; opacity: 0; overflow: hidden; }
  @media (prefers-reduced-motion: reduce) { .collapse a { transition: none; } }
</style>
