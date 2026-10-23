<script lang="ts">
  // Slow realtime: while the tab is visible, ask the server every 15 s whether
  // anything changed since our cursor, and reload the page data if so.
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  let { cursor, thread, parent }: { cursor: string; thread?: string; parent?: string } = $props();
  onMount(() => {
    let since = cursor;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      const q = new URLSearchParams({ since });
      if (thread) q.set('thread', thread);
      if (parent) q.set('parent', parent);
      try {
        const res = await fetch(`/api/changes?${q}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.changes.length) await invalidateAll();
        since = data.cursor;
      } catch { /* offline; try again next tick */ }
    };
    const id = setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  });
</script>
