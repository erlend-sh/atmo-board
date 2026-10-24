<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import Icon from './Icon.svelte';
  // Follow, reset or mute a thread or channel, Discourse style: a button
  // showing the level, opening a menu that explains each one. Muted ones
  // leave Index and stop counting as unread.
  let { thread, level = 'normal', channel = false }: { thread: string; level?: string; channel?: boolean } = $props();
  const what = $derived(channel ? 'channel' : 'thread');
  const LEVELS = $derived([
    { id: 'watching', label: 'Watching', desc: `You'll be notified of every new post in this ${what}.` },
    { id: 'normal', label: 'Normal', desc: 'You\'ll be notified if someone mentions you or replies to you.' },
    { id: 'muted', label: 'Muted', desc: `You won't be notified about this ${what}, and it stays out of Index and unread.` },
  ]);
  const current = $derived(LEVELS.find((l) => l.id === level) ?? LEVELS[1]);
  let open = $state(false);
  let root: HTMLElement;
</script>

<svelte:window onclick={(e) => { if (open && !root.contains(e.target as Node)) open = false; }}
  onkeydown={(e) => { if (e.key === 'Escape') open = false; }} />

<div class="notify" bind:this={root}>
  <button class="btn small" aria-haspopup="menu" aria-expanded={open} title="Notifications for this {what}" onclick={() => (open = !open)}>
    <Icon name={level === 'muted' ? 'bellOff' : 'bell'} />{current.label}
  </button>
  {#if open}
    <div class="menu" role="menu" aria-label="Notifications for this {what}">
      <form method="POST" action="?/notify"
        use:enhance={() => async ({ update }) => { open = false; await update({ reset: false }); invalidate('app:sidebar'); }}>
        <input type="hidden" name="thread" value={thread} />
        {#each LEVELS as l (l.id)}
          <button role="menuitemradio" aria-checked={l.id === current.id} name="level" value={l.id}>
            <Icon name={l.id === 'muted' ? 'bellOff' : 'bell'} /><b>{l.label}</b><small>{l.desc}</small>
          </button>
        {/each}
      </form>
    </div>
  {/if}
</div>

<style>
  .notify { position: relative; display: inline-grid; }
  .btn { gap: 6px; }
  .menu { position: absolute; right: 0; top: calc(100% + 6px); width: 280px; z-index: 6; padding: 6px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px var(--shadow); }
  .menu button { display: grid; grid-template-columns: 20px 1fr; gap: 2px 8px; width: 100%; text-align: left; padding: 8px 10px;
    border: 0; border-radius: 6px; background: none; color: var(--text); cursor: pointer; }
  .menu button:hover { background: var(--surface-2); }
  .menu button[aria-checked="true"] { background: var(--accent-soft); }
  .menu :global(svg) { margin-top: 2px; }
  b { font-weight: 600; font-size: 14px; }
  small { grid-column: 2; font-size: 12.5px; line-height: 1.4; color: var(--muted); }
</style>
