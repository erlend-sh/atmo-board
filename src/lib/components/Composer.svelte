<script lang="ts">
  import { enhance } from '$app/forms';
  import { channelLabel } from '$lib/directories';
  let { action, placeholder = 'Write a message…', title = false, titleHint = 'Thread title', submit = 'Send', hidden = {}, channels,
    above, onposted, onactive, textarea = $bindable() }: {
    action: string; placeholder?: string; title?: boolean; titleHint?: string; submit?: string; hidden?: Record<string, string>;
    /** Channels to pick from, posted as `parent`. */
    channels?: { key: string; title: string }[];
    /** A line above the box, e.g. who you're replying to. */
    above?: import('svelte').Snippet;
    onposted?: () => void;
    /** Typing started: a thread's reply box becomes sticky. */
    onactive?: () => void;
    textarea?: HTMLTextAreaElement;
  } = $props();
  let text = $state('');
  let busy = $state(false);
  let error = $state('');
  let form: HTMLFormElement;
  function keydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (!title && !e.shiftKey))) {
      e.preventDefault();
      if (text.trim()) form.requestSubmit();
    }
  }
</script>

<form bind:this={form} method="POST" {action} class="composer" use:enhance={() => {
  busy = true; error = '';
  return async ({ result, update }) => {
    busy = false;
    if (result.type === 'failure') { error = (result.data as any)?.message ?? 'Could not post'; return; }
    text = '';
    await update({ reset: true });
    onposted?.();
  };
}}>
  {@render above?.()}
  {#each Object.entries(hidden) as [k, v]}<input type="hidden" name={k} value={v} />{/each}
  {#if channels?.length}
    <select name="parent" class="pick" aria-label="Channel">
      {#each channels as c (c.key)}<option value={c.key}>#{channelLabel(c)}</option>{/each}
    </select>
  {/if}
  {#if title}<input name="title" required maxlength="300" placeholder={titleHint} autocomplete="off" />{/if}
  <textarea name="text" bind:this={textarea} bind:value={text} {placeholder} rows={title ? 5 : 2} required onkeydown={keydown}
    oninput={() => onactive?.()}></textarea>
  <div class="row">
    <span class="grow">Markdown works.{title ? '' : ' Enter sends, Shift+Enter for a new line.'}</span>
    <button class="btn primary small" type="submit" disabled={busy || !text.trim()}>{submit}</button>
  </div>
  {#if error}<p class="error">{error}</p>{/if}
</form>

<style>
  .composer { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
  .composer:focus-within { border-color: var(--accent); }
  input, textarea { width: 100%; border: 0; background: none; color: var(--text); font: inherit; padding: 6px 8px; }
  input { font-weight: 600; font-size: 16px; border-bottom: 1px solid var(--border); }
  textarea { resize: none; min-height: 48px; field-sizing: content; max-height: 40vh; }
  input:focus, textarea:focus { outline: none; }
  .pick { justify-self: start; height: 34px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text);
    padding: 0 8px; font: inherit; font-size: 14px; }
  .row { display: flex; gap: 8px; align-items: center; }
  .grow { flex: 1; min-width: 0; font-size: 12.5px; color: var(--muted); }
  .error { color: var(--danger); margin: 0; font-size: 14px; }
</style>
