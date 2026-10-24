<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PostView, RevisionView } from '$lib/types';
  import { renderMarkdown } from '$lib/markdown';
  import { age, fullDate } from '$lib/time';
  import { displayName } from '$lib/names';
  import Avatar from './Avatar.svelte';
  let { post, threadHref, compact = false, viewer, canReact = false, title, deleteTo, onreply }: {
    post: PostView; threadHref: string; compact?: boolean;
    /** The signed-in member's DID; their own posts get Edit and Delete. */
    viewer?: string;
    canReact?: boolean;
    /** The thread title, when this is a thread's opening post (editing it can retitle the thread). */
    title?: string;
    /** Where to go after deleting (a deleted thread has no page). */
    deleteTo?: string;
    onreply?: () => void;
  } = $props();
  const PALETTE = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];
  const body = $derived(renderMarkdown(post.content?.text ?? post.textContent));
  const staff = $derived(post.author.roles.includes('admin') || post.author.roles.includes('moderator'));
  const mine = $derived(!!viewer && viewer === post.author.did && !post.deleted);
  let picking = $state(false);
  let editing = $state(false);
  let history = $state<RevisionView[] | null>(null);
  let error = $state('');

  async function showHistory() {
    if (history) { history = null; return; }
    const res = await fetch(`/api/history/${post.key}`);
    history = res.ok ? (await res.json()).revisions.filter((r: RevisionView) => !r.current).toReversed() : [];
  }
  // Every form here refreshes the page's data on success and reports failures inline.
  const submit = (after?: () => void) => () => async ({ result, update }: any) => {
    if (result.type === 'failure') { error = result.data?.message ?? 'Something went wrong'; return; }
    error = '';
    after?.();
    await update({ reset: false });
  };
</script>

<article class="post" class:compact class:deleted={post.deleted} id="post-{post.number}" data-number={post.number}>
  {#if !compact}<Avatar author={post.author} size={40} />{:else}<span class="gutter"></span>{/if}
  <div class="main">
    {#if !compact}
      <header>
        <a class="name" href="/u/{post.author.handle ?? post.author.did}">{displayName(post.author)}</a>
        {#if staff}<span class="badge">staff</span>{/if}
        {#if post.replyTo && post.replyTo > 1}<a class="reply-to" href="{threadHref}/{post.replyTo}">↩ #{post.replyTo}</a>{/if}
        {#if post.editCount}<button class="edited" onclick={showHistory} title="Show edit history">edited</button>{/if}
        <a class="when" href="/p/{post.key}" data-sveltekit-reload title={fullDate(post.createdAt)}>{age(post.createdAt)}</a>
      </header>
    {/if}

    {#if post.deleted}
      <p class="gone">This post was deleted by its author.</p>
    {:else if editing}
      <form class="edit" method="POST" action="?/edit" use:enhance={submit(() => (editing = false))}>
        <input type="hidden" name="key" value={post.key} />
        {#if title !== undefined}<input name="title" value={title} required maxlength="300" aria-label="Thread title" />{/if}
        <!-- svelte-ignore a11y_autofocus -->
        <textarea name="text" required autofocus value={post.content?.text ?? post.textContent}
          onkeydown={(e) => e.key === 'Escape' && (editing = false)}></textarea>
        <div class="row">
          <button class="btn primary" type="submit">Save</button>
          <button class="btn" type="button" onclick={() => (editing = false)}>Cancel</button>
        </div>
      </form>
    {:else}
      <div class="body prose">{@html body}</div>
      {#if compact && post.editCount}<button class="edited" onclick={showHistory} title="Show edit history">(edited)</button>{/if}
    {/if}

    {#if history}
      <ol class="history" aria-label="Earlier versions">
        {#each history as rev (rev.version)}
          <li>
            <span class="meta">Version {rev.version} · {fullDate(rev.createdAt)}</span>
            {#if rev.title}<strong>{rev.title}</strong>{/if}
            <div class="prose">{@html renderMarkdown(rev.content?.text ?? rev.textContent)}</div>
          </li>
        {/each}
      </ol>
    {/if}

    {#if !post.deleted && (post.reactions?.length || picking)}
      <div class="reactions">
        {#each post.reactions ?? [] as r (r.emoji)}
          <form method="POST" action="?/react" use:enhance={submit()}>
            <input type="hidden" name="post" value={post.key} />
            <input type="hidden" name="emoji" value={r.emoji} />
            {#if r.viewer}<input type="hidden" name="op" value="unreact" />{/if}
            <button class="reaction" class:mine={r.viewer} disabled={!canReact}
              title={r.viewer ? 'Remove your reaction' : 'React'}>{r.emoji} {r.count}</button>
          </form>
        {/each}
        {#if picking}
          <div class="palette" role="group" aria-label="Pick a reaction">
            {#each PALETTE as emoji}
              <form method="POST" action="?/react" use:enhance={submit(() => (picking = false))}>
                <input type="hidden" name="post" value={post.key} />
                <input type="hidden" name="emoji" value={emoji} />
                <button aria-label="React {emoji}">{emoji}</button>
              </form>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
  </div>

  {#if !post.deleted && !editing && (canReact || mine || onreply)}
    <div class="actions">
      {#if canReact}<button onclick={() => (picking = !picking)} aria-label="Add reaction" title="Add reaction">☺︎</button>{/if}
      {#if onreply}<button onclick={onreply}>Reply</button>{/if}
      {#if mine}
        <button onclick={() => { editing = true; picking = false; }}>Edit</button>
        <form method="POST" action="?/delete" use:enhance={({ cancel }) => {
          if (!confirm(title !== undefined ? 'Delete this thread?' : 'Delete this post?')) cancel();
          return submit()();
        }}>
          <input type="hidden" name="key" value={post.key} />
          {#if deleteTo}<input type="hidden" name="then" value={deleteTo} />{/if}
          <button class="danger">Delete</button>
        </form>
      {/if}
    </div>
  {/if}
</article>

<style>
  .post { position: relative; display: flex; gap: 12px; padding: 10px 0; }
  .post.compact { padding-top: 2px; }
  .gutter { width: 40px; flex: none; }
  .main { min-width: 0; flex: 1; }
  header { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 2px; }
  .name { font-weight: 600; color: var(--text); }
  .badge { font-size: 11px; padding: 0 6px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); }
  .when, .reply-to { color: var(--muted); font-size: 13px; }
  .when { margin-left: auto; }
  .edited { background: none; border: 0; padding: 0; font: inherit; font-size: 12px; color: var(--muted); cursor: pointer; }
  .edited:hover { color: var(--accent); }
  .gone { color: var(--muted); font-style: italic; margin: 2px 0; }
  .reactions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; align-items: center; }
  .reaction { font: inherit; font-size: 13px; padding: 1px 8px; border-radius: 12px; border: 1px solid transparent;
    background: var(--surface-2); color: var(--text); cursor: pointer; }
  .reaction:disabled { cursor: default; }
  .reaction.mine { border-color: var(--accent); background: var(--accent-soft); }
  .palette { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
  .palette button { background: none; border: 0; font-size: 16px; padding: 2px 5px; border-radius: 10px; cursor: pointer; }
  .palette button:hover { background: var(--surface-2); }
  .actions { position: absolute; top: 4px; right: 0; display: flex; gap: 2px; padding: 2px; border-radius: 8px;
    background: var(--surface); border: 1px solid var(--border); opacity: 0; pointer-events: none; }
  .post:hover .actions, .actions:focus-within { opacity: 1; pointer-events: auto; }
  @media (hover: none) { .actions { position: static; opacity: 1; pointer-events: auto; border: 0; align-self: flex-start; } }
  .actions button { background: none; border: 0; color: var(--muted); font: inherit; font-size: 13px; padding: 2px 8px;
    border-radius: 6px; cursor: pointer; }
  .actions button:hover { background: var(--surface-2); color: var(--text); }
  .actions .danger:hover { color: var(--danger); }
  .edit { display: grid; gap: 8px; margin: 4px 0; }
  .edit input, .edit textarea { width: 100%; font: inherit; color: var(--text); background: var(--surface-2);
    border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
  .edit input { font-weight: 600; }
  .edit textarea { min-height: 80px; field-sizing: content; max-height: 50vh; resize: vertical; }
  .row { display: flex; gap: 8px; }
  .history { list-style: none; margin: 8px 0 0; padding: 0 0 0 12px; border-left: 2px solid var(--border); display: grid; gap: 10px; }
  .history .meta { display: block; font-size: 12px; color: var(--muted); }
  .history .prose { font-size: 14px; }
  .error { color: var(--danger); margin: 4px 0 0; font-size: 13px; }
</style>
