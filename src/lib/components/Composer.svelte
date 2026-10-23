<script lang="ts">
  import { enhance } from '$app/forms';
  let { action, placeholder = 'Write a message…', title = false, submit = 'Send', hidden = {}, onposted }:
    { action: string; placeholder?: string; title?: boolean; submit?: string; hidden?: Record<string, string>; onposted?: () => void } = $props();
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
  {#each Object.entries(hidden) as [k, v]}<input type="hidden" name={k} value={v} />{/each}
  {#if title}<input name="title" required maxlength="300" placeholder="Thread title" autocomplete="off" />{/if}
  <div class="row">
    <textarea name="text" bind:value={text} {placeholder} rows={title ? 5 : 1} required onkeydown={keydown}></textarea>
    <button type="submit" disabled={busy || !text.trim()}>{submit}</button>
  </div>
  {#if error}<p class="error">{error}</p>{/if}
</form>

<style>
  .composer { display: grid; gap: 8px; }
  .row { display: flex; gap: 8px; align-items: flex-end; }
  input, textarea { width: 100%; font: inherit; color: var(--text); background: var(--surface-2);
    border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
  input { font-weight: 600; }
  textarea { resize: vertical; min-height: 42px; field-sizing: content; max-height: 40vh; }
  input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  button { flex: none; height: 42px; padding: 0 16px; border: 0; border-radius: 8px; font: inherit; font-weight: 600;
    background: var(--accent); color: var(--on-accent); cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .error { color: var(--danger); margin: 0; font-size: 14px; }
</style>
