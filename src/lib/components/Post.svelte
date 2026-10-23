<script lang="ts">
  import type { PostView } from '$lib/types';
  import { renderMarkdown } from '$lib/markdown';
  import { age, fullDate } from '$lib/time';
  import { displayName } from '$lib/names';
  import Avatar from './Avatar.svelte';
  let { post, threadHref, compact = false }: { post: PostView; threadHref: string; compact?: boolean } = $props();
  const body = $derived(renderMarkdown(post.content?.text ?? post.textContent));
  const staff = $derived(post.author.roles.includes('admin') || post.author.roles.includes('moderator'));
</script>

<article class="post" class:compact id="post-{post.number}" data-number={post.number}>
  {#if !compact}<Avatar author={post.author} size={40} />{:else}<span class="gutter"></span>{/if}
  <div class="main">
    {#if !compact}
      <header>
        <a class="name" href="/u/{post.author.handle ?? post.author.did}">{displayName(post.author)}</a>
        {#if staff}<span class="badge">staff</span>{/if}
        {#if post.replyTo && post.replyTo > 1}<a class="reply-to" href="{threadHref}/{post.replyTo}">↩ #{post.replyTo}</a>{/if}
        <a class="when" href="/p/{post.key}" data-sveltekit-reload title={fullDate(post.createdAt)}>{age(post.createdAt)}</a>
      </header>
    {/if}
    <div class="body prose">{@html body}</div>
    {#if post.reactions?.length}
      <div class="reactions">
        {#each post.reactions as r (r.emoji)}<span class="reaction" class:mine={r.viewer}>{r.emoji} {r.count}</span>{/each}
      </div>
    {/if}
  </div>
</article>

<style>
  .post { display: flex; gap: 12px; padding: 10px 0; }
  .post.compact { padding-top: 2px; }
  .gutter { width: 40px; flex: none; }
  .main { min-width: 0; flex: 1; }
  header { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 2px; }
  .name { font-weight: 600; color: var(--text); }
  .badge { font-size: 11px; padding: 0 6px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); }
  .when, .reply-to { color: var(--muted); font-size: 13px; }
  .when { margin-left: auto; }
  .reactions { display: flex; gap: 6px; margin-top: 6px; }
  .reaction { font-size: 13px; padding: 1px 8px; border-radius: 12px; background: var(--surface-2); }
  .reaction.mine { outline: 1px solid var(--accent); }
</style>
