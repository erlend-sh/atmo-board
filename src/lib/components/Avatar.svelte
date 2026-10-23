<script lang="ts">
  import type { Author } from '$lib/types';
  import { hue, initials, displayName } from '$lib/names';
  let { author, size = 36 }: { author: Author; size?: number } = $props();
</script>

{#if author.avatar}
  <img class="avatar" src={author.avatar} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" />
{:else}
  <span class="avatar" aria-hidden="true" title={displayName(author)}
    style:width="{size}px" style:height="{size}px" style:font-size="{Math.round(size * 0.45)}px"
    style:background="hsl({hue(author.did)} 55% 45%)">{initials(author)}</span>
{/if}

<style>
  .avatar {
    display: inline-grid; place-items: center; flex: none; border-radius: 50%;
    color: #fff; font-weight: 600; object-fit: cover; user-select: none;
  }
</style>
