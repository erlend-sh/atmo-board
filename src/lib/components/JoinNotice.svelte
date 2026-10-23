<script lang="ts">
  import type { ViewerState } from '$lib/types';
  let { viewer }: { viewer: ViewerState } = $props();
</script>

{#if !viewer.did}
  <div class="notice"><span>Sign in with your atproto account to join the conversation.</span><a class="btn primary" href="/login">Sign in</a></div>
{:else if !viewer.member}
  <form class="notice" method="POST" action="/join">
    <span>You're signed in but not a member yet.</span>
    <button class="btn primary">Join this forum</button>
  </form>
{/if}
