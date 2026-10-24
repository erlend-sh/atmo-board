<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import { displayName } from '$lib/names';
  let { data, form } = $props();
</script>

<svelte:head><title>Sign in · {data.forum.name}</title></svelte:head>

<div class="page narrow">
  <h1>Sign in to {data.forum.name}</h1>
  <p class="muted">Use your atproto account: a Bluesky handle, or one from any other PDS.</p>
  <form method="POST" action="?/oauth" class="handle">
    {#if data.next}<input type="hidden" name="next" value={data.next} />{/if}
    <input name="handle" placeholder="alice.bsky.social" required autocomplete="username" autocapitalize="none"
      spellcheck="false" value={form && 'handle' in form ? form.handle : ''} aria-label="Handle" />
    <button class="btn primary">Sign in</button>
  </form>
  {#if form?.message}<p class="error">{form.message}</p>{/if}

  {#if data.devLogin}
    <h2>Demo sign-in</h2>
    <p class="muted">Local demo mode is on, so you can also be one of the seeded members without a PDS.</p>
    <form method="POST" action="?/member" class="members">
      {#if data.next}<input type="hidden" name="next" value={data.next} />{/if}
      {#each data.members as m (m.did)}
        <button name="did" value={m.did} class="member">
          <Avatar author={m} size={32} />
          <span class="who"><b>{displayName(m)}</b><span>@{m.handle ?? m.did}</span></span>
          {#if m.roles.includes('admin')}<span class="role">admin</span>{:else if m.roles.includes('moderator')}<span class="role">mod</span>{/if}
        </button>
      {/each}
    </form>
    <h2>Or arrive as a newcomer</h2>
    <form method="POST" action="?/newcomer" class="newcomer">
      {#if data.next}<input type="hidden" name="next" value={data.next} />{/if}
      <input name="name" placeholder="name, e.g. carol" required autocomplete="off" />
      <button class="btn primary">Continue</button>
    </form>
  {/if}
</div>

<style>
  .narrow { max-width: 520px; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  .muted { color: var(--muted); }
  .members { display: grid; gap: 6px; margin-top: 16px; }
  .member { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius);
    border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; }
  .member:hover { border-color: var(--accent); }
  .who { flex: 1; display: grid; }
  .who span { color: var(--muted); font-size: 13px; }
  .role { font-size: 12px; padding: 0 6px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); }
  .newcomer, .handle { display: flex; gap: 8px; }
  .handle { margin-top: 16px; }
  .newcomer input, .handle input { flex: 1; font: inherit; color: var(--text); background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 12px; }
  .error { color: var(--danger); }
</style>
