<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import { displayName } from '$lib/names';
  let { data } = $props();
  const m = $derived(data.member);
</script>

<svelte:head><title>{displayName(m)} · {data.forum.name}</title></svelte:head>

<div class="page">
  <div class="head">
    <Avatar author={m} size={72} />
    <div>
      <h1>{displayName(m)}</h1>
      <p>@{m.handle ?? m.did}</p>
      <p class="roles">{#each m.roles as r}<span>{r}</span>{/each}{#if m.trustLevel !== undefined}<span>trust level {m.trustLevel}</span>{/if}</p>
    </div>
  </div>
</div>

<style>
  .head { display: flex; gap: 18px; align-items: center; }
  h1 { font-size: 24px; }
  p { margin: 2px 0 0; color: var(--muted); }
  .roles { display: flex; gap: 6px; margin-top: 8px; }
  .roles span { font-size: 12px; padding: 1px 8px; border-radius: 4px; background: var(--surface-2); color: var(--text-2); }
</style>
