<script lang="ts" module>
  // Line icons on a 16px grid: [default size, svg body].
  const ICONS = {
    home: [16, '<path d="M2.5 7.2 8 2.5l5.5 4.7M4 6v7.5h3V10h2v3.5h3V6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
    hash: [16, '<path d="M6.3 2 4.7 14M11.3 2 9.7 14M2.6 5.6h11.6M1.8 10.4h11.6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>'],
    lock: [16, '<rect x="3" y="7" width="10" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    shield: [16, '<path d="M8 1.8 13 3.6v4c0 3.1-2.1 5.4-5 6.6-2.9-1.2-5-3.5-5-6.6v-4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'],
    review: [16, '<path d="M3 2.5h10v11H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m5.5 8 1.8 1.8L10.8 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'],
    search: [14, '<circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m10.6 10.6 3.4 3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'],
    menu: [16, '<path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'],
    pin: [13, '<path d="M9.5 1.8 14.2 6.5l-2 .6-2.6 2.6-.4 3.2-6.1-6.1 3.2-.4L8.9 3.8z" fill="currentColor"/><path d="m4.6 11.4-2.8 2.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'],
    chat: [16, '<path d="M2.5 3.5h11v7.2H7l-3.2 2.6v-2.6H2.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 6.3h6M5 8.4h3.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'],
    replyArrow: [15, '<path d="M6.5 3.5 2.5 7.5l4 4M2.8 7.5h6.7a4 4 0 0 1 4 4V13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'],
    groups: [16, '<circle cx="6" cy="5.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M1.8 13.2c.4-2.3 2.1-3.7 4.2-3.7s3.8 1.4 4.2 3.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10.6 3.6a2.2 2.2 0 1 1 .3 4.2M11.6 9.7c1.5.3 2.4 1.6 2.6 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'],
    projects: [16, '<path d="M2 5.2V12.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.2a1 1 0 0 0-1-1H8L6.6 3.5H3a1 1 0 0 0-1 1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'],
    calendar: [16, '<rect x="2.2" y="3.2" width="11.6" height="10.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.2 6.6h11.6M5.4 1.8v2.6M10.6 1.8v2.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'],
    pinMap: [13, '<path d="M8 14.5s4.8-4.4 4.8-8.1a4.8 4.8 0 0 0-9.6 0c0 3.7 4.8 8.1 4.8 8.1z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6.4" r="1.7" fill="currentColor"/>'],
    bell: [15, '<path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.2H2.8zM6.5 14h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'],
    bellOff: [15, '<path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.2H2.8zM6.5 14h3M2 2l12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'],  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size }: { name: IconName; size?: number } = $props();
  const icon = $derived(ICONS[name]);
</script>

<svg width={size ?? icon[0]} height={size ?? icon[0]} viewBox="0 0 16 16" aria-hidden="true">{@html icon[1]}</svg>
