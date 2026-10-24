import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api, publishTrust } from '$lib/server/hv';
import { actionFailure, pageError } from '$lib/server/errors';
import type { ThreadPage, ThreadView } from '$lib/types';
import { channelHref, threadHref } from '$lib/names';
import { postActions } from '$lib/server/postActions';

// A channel is a thread with a sidebar entry. Its own posts are the untitled
// chat, at /c/{key}/{slug}/chat and titled "{channel}/chat"; its child
// threads are the named threads, listed at /c/{key}/{slug} under the chat row.
export const load: PageServerLoad = async ({ locals, params, url }) => {
  const hv = api(locals.viewer);
  const parts = params.rest.split('/').filter(Boolean);
  const chatView = parts.at(-1) === 'chat' || url.searchParams.get('view') === 'chat';
  if (parts.at(-1) === 'chat') parts.pop();
  if (parts.length > 1) error(404, 'Not found');
  const view = chatView ? 'chat' : 'threads';
  let chat: ThreadPage, list: { threads: ThreadView[]; changeCursor: string };
  try {
    [chat, list] = await Promise.all([
      hv.query<ThreadPage>('getThread', { key: params.key, anchor: 'last', before: 50, after: 0 }),
      hv.query<{ threads: ThreadView[]; changeCursor: string }>('listThreads', { parent: params.key, limit: 50 }),
    ]);
  } catch (e) { pageError(e); }
  if (!chat.thread.isChannel) redirect(301, threadHref(chat.thread));
  // A stale slug, or milestone 1's ?view=chat, redirects to the canonical URL.
  if (chat.thread.slug !== parts[0] || url.searchParams.has('view')) redirect(301, channelHref(chat.thread, chatView));
  let marked = false;
  const last = chat.posts.at(-1)?.number ?? 0;
  if (view === 'chat' && locals.viewer && last > (chat.thread.lastReadNumber ?? 0)) {
    marked = await hv.procedure<{ trustLevel?: number }>('markRead', { thread: params.key, number: last })
      .then((r) => (publishTrust(r, locals.viewer), true), () => false);
  }
  return { chat, threads: list.threads, view, marked, changeCursor: chat.changeCursor };
};

export const actions: Actions = {
  ...postActions,
  chat: async ({ locals, params, request }) => {
    const form = await request.formData();
    const text = String(form.get('text') ?? '').trim();
    if (!text) return;
    try {
      await api(locals.viewer).procedure('createPost', {
        thread: params.key, textContent: text, content: { $type: 'dev.atmoboard.defs#markdown', text },
        whisper: form.get('whisper') === '1' || undefined,
      });
    } catch (e) { return actionFailure(e); }
  },
  thread: async ({ locals, params, request }) => {
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    const text = String(form.get('text') ?? '').trim();
    let created: { key: string; slug: string };
    try {
      created = await api(locals.viewer).procedure('createThread', {
        parent: params.key, title, textContent: text, content: { $type: 'dev.atmoboard.defs#markdown', text },
      });
    } catch (e) { return actionFailure(e); }
    redirect(303, threadHref(created));
  },
};
