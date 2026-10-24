<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  // Follow, reset or mute a thread or channel. Muted ones leave Latest and
  // stop counting as unread.
  let { thread, level = 'normal', channel = false }: { thread: string; level?: string; channel?: boolean } = $props();
  let form: HTMLFormElement;
  const hint = $derived(level === 'muted' ? `Muted: this ${channel ? 'channel' : 'thread'} stays out of Latest and unread`
    : level === 'watching' ? 'Watching' : '');
</script>

<form bind:this={form} method="POST" action="?/notify" class="notify" title={hint} use:enhance={() => async ({ update }) => {
  await update({ reset: false });
  invalidate('app:sidebar');
}}>
  <input type="hidden" name="thread" value={thread} />
  <select name="level" aria-label="Notifications" value={level} onchange={() => form.requestSubmit()}>
    <option value="watching">🔔 Watching</option>
    <option value="normal">Normal</option>
    <option value="muted">🔕 Muted</option>
  </select>
</form>

<style>
  select { font: inherit; font-size: 13px; color: var(--text-2); background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 6px 8px; cursor: pointer; }
</style>
