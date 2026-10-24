<script lang="ts">
  import { enhance } from '$app/forms';
  import type { Permissions, ThreadView } from '$lib/types';
  // Thread-level overrides, by what the viewer may do: TL3 renames and
  // moves, TL4 and staff also pin, lock and hide. Each one is written as a
  // forum-signed override naming the staff member.
  let { thread, perms, channels = [] }: {
    thread: ThreadView; perms: Permissions; channels?: { key: string; title: string; icon?: string }[];
  } = $props();
  let open = $state(false);
  let renaming = $state(false);
  let moving = $state(false);
  const act = () => async ({ update }: any) => { open = false; await update({ reset: false }); };
</script>

<div class="mod">
  <button class="btn" onclick={() => (open = !open)} aria-expanded={open}>Moderate</button>
  {#if open}
    <div class="menu">
      {#if perms.curate}
        <button onclick={() => { renaming = !renaming; moving = false; }}>Rename…</button>
        {#if channels.length}<button onclick={() => { moving = !moving; renaming = false; }}>Move…</button>{/if}
      {/if}
      {#if perms.manage}
        {#each [
          { action: thread.state.pinned ? 'unpin' : 'pin', label: thread.state.pinned ? 'Unpin' : 'Pin to the top' },
          { action: thread.state.locked ? 'unlock' : 'lock', label: thread.state.locked ? 'Unlock' : 'Lock' },
          { action: thread.state.hidden ? 'unhide' : 'hide', label: thread.state.hidden ? 'Unhide' : 'Hide from members' },
        ] as item (item.action)}
          <form method="POST" action="?/moderate" use:enhance={act}>
            <input type="hidden" name="subject" value={thread.key} />
            <input type="hidden" name="action" value={item.action} />
            <button>{item.label}</button>
          </form>
        {/each}
      {/if}
    </div>
  {/if}

  {#if renaming}
    <form class="inline" method="POST" action="?/moderate" use:enhance={() => async ({ update }) => { renaming = false; await update({ reset: false }); }}>
      <input type="hidden" name="subject" value={thread.key} />
      <input type="hidden" name="action" value="rename" />
      <input name="title" value={thread.title ?? ''} required maxlength="300" aria-label="New title" />
      <input name="reason" placeholder="Why? (optional)" maxlength="500" />
      <button class="btn primary">Rename</button>
    </form>
  {/if}
  {#if moving}
    <form class="inline" method="POST" action="?/moderate" use:enhance={() => async ({ update }) => { moving = false; await update({ reset: false }); }}>
      <input type="hidden" name="subject" value={thread.key} />
      <input type="hidden" name="action" value="move" />
      <select name="toThread" aria-label="Move to channel">
        {#each channels as c (c.key)}<option value={c.key} selected={c.key === thread.parent}>{c.icon ?? '#'} {c.title}</option>{/each}
      </select>
      <input name="reason" placeholder="Why? (optional)" maxlength="500" />
      <button class="btn primary">Move</button>
    </form>
  {/if}
</div>

<style>
  .mod { position: relative; }
  .menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 10; min-width: 190px; display: grid;
    padding: 4px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface);
    box-shadow: 0 8px 24px rgb(0 0 0 / .12); }
  .menu button { background: none; border: 0; font: inherit; font-size: 14px; color: var(--text); text-align: left;
    padding: 7px 10px; border-radius: 6px; cursor: pointer; width: 100%; }
  .menu button:hover { background: var(--surface-2); }
  .inline { position: absolute; right: 0; top: calc(100% + 4px); z-index: 10; display: flex; gap: 6px; width: max-content;
    max-width: 90vw; padding: 8px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface);
    box-shadow: 0 8px 24px rgb(0 0 0 / .12); }
  .inline input, .inline select { font: inherit; font-size: 14px; color: var(--text); background: var(--surface-2);
    border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; }
</style>
