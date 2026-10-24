<script lang="ts">
  import { enhance } from '$app/forms';
  import Avatar from '$lib/components/Avatar.svelte';
  import { channelHref, displayName } from '$lib/names';
  let { data, form } = $props();
  const TRUST = ['New', 'Basic', 'Member', 'Regular', 'Leader'];
  const channels = $derived(data.sections.flatMap((s) => s.channels));
  let adding = $state(false);
</script>

<svelte:head><title>Admin · {data.forum.name}</title></svelte:head>

<div class="page">
  <div class="page-head">
    <div class="grow"><h1>Admin</h1><p>Channels and members of {data.forum.name}.</p></div>
    <button class="btn primary" onclick={() => (adding = !adding)}>{adding ? 'Cancel' : 'New channel'}</button>
  </div>
  {#if form?.message}<p class="error">{form.message}</p>{/if}

  {#if adding}
    <form class="card" method="POST" action="?/channel" use:enhance={() => async ({ update }) => { adding = false; await update(); }}>
      <div class="row">
        <input name="title" placeholder="Channel name, e.g. announcements" required maxlength="80" />
        <input name="icon" placeholder="🎉" maxlength="2" class="icon" aria-label="Icon" />
        <input name="section" placeholder="Section (optional)" maxlength="60" />
      </div>
      <input name="description" placeholder="What's this channel for?" maxlength="300" />
      <label class="check"><input type="checkbox" name="private" value="1" />
        Private: its own space, staff only to start. This can't be changed later.</label>
      <button class="btn primary">Create channel</button>
    </form>
  {/if}

  <h2>Channels</h2>
  <ul class="channels">
    {#each channels as c (c.key)}
      <li>
        <a href={channelHref(c)}>{c.icon ?? '#'} {c.title}</a>
        {#if c.private}<span class="tag">private</span>{/if}
        <span class="muted">{c.section || 'no section'} · {c.threadCount ?? 0} threads</span>
      </li>
    {/each}
  </ul>

  <h2>Members</h2>
  <ul class="members">
    {#each data.members as m (m.did)}
      {@const role = m.roles.includes('admin') ? 'admin' : m.roles.includes('moderator') ? 'moderator' : 'member'}
      <li>
        <Avatar author={m} size={32} />
        <a class="who" href="/u/{m.handle ?? m.did}">{displayName(m)}</a>
        <form method="POST" action="?/roles" use:enhance={() => async ({ update }) => update({ reset: false })}>
          <input type="hidden" name="member" value={m.did} />
          <select name="role" value={role} onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Role">
            <option value="member">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </form>
        <form class="trust" method="POST" action="?/trust" use:enhance={() => async ({ update }) => update({ reset: false })}>
          <input type="hidden" name="member" value={m.did} />
          <select name="level" value={String(m.trustLevel ?? 0)} onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Trust level">
            {#each TRUST as name, i}<option value={String(i)}>TL{i} {name}</option>{/each}
          </select>
        </form>
        <form method="POST" action="?/remove" use:enhance={({ cancel }) => {
          if (!confirm(`Remove ${displayName(m)} from the forum? Their posts stay.`)) cancel();
          return async ({ update }) => update({ reset: false });
        }}>
          <input type="hidden" name="member" value={m.did} />
          <button class="link-btn">Remove</button>
        </form>
      </li>
    {/each}
  </ul>
  <p class="muted note">Setting a trust level by hand locks it, so automatic promotion leaves it alone.</p>
</div>

<style>
  h2 { font-size: 16px; margin: 26px 0 8px; }
  .card { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--surface); margin-bottom: 16px; }
  .row { display: flex; gap: 8px; }
  .row input { flex: 1; }
  .icon { max-width: 70px; text-align: center; }
  input, select { font: inherit; font-size: 14px; color: var(--text); background: var(--surface-2);
    border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
  .check { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
  .check input { width: auto; }
  .channels, .members { list-style: none; margin: 0; padding: 0; }
  .channels li, .members li { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--border); }
  .members .who { flex: 1; min-width: 0; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .channels a { font-weight: 600; color: var(--text); }
  .muted { color: var(--muted); font-size: 14px; }
  .channels .muted { margin-left: auto; }
  .tag { font-size: 11px; padding: 0 6px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); }
  .link-btn { background: none; border: 0; color: var(--muted); font: inherit; font-size: 13px; cursor: pointer; }
  .link-btn:hover { color: var(--danger); }
  .note { margin-top: 10px; }
  .error { color: var(--danger); }
</style>
