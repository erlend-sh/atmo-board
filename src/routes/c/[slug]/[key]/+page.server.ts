import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { actionFailure, pageError } from '$lib/server/errors';
import type { ThreadPage, ThreadView } from '$lib/types';

// A channel is a thread with a sidebar entry. Its own posts are the untitled
// chat; its child threads are the named threads.
export const load: PageServerLoad = async ({ locals, params, url }) => {
  const hv = api(locals.viewer);
  const view = url.searchParams.get('view') === 'chat' ? 'chat' : 'threads';
  let chat: ThreadPage, list: { threads: ThreadView[]; changeCursor: string };
  try {
    [chat, list] = await Promise.all([
      hv.query<ThreadPage>('getThread', { key: params.key, anchor: 'last', before: 50, after: 0 }),
      hv.query<{ threads: ThreadView[]; changeCursor: string }>('listThreads', { parent: params.key, limit: 50 }),
    ]);
  } catch (e) { pageError(e); }
  if (!chat.thread.isChannel) redirect(301, `/t/${chat.thread.slug}/${chat.thread.key}`);
  if (chat.thread.slug !== params.slug) redirect(301, `/c/${chat.thread.slug}/${chat.thread.key}${url.search}`);
  let marked = false;
  const last = chat.posts.at(-1)?.number ?? 0;
  if (view === 'chat' && locals.viewer && last > (chat.thread.lastReadNumber ?? 0)) {
    marked = await hv.procedure('markRead', { thread: params.key, number: last }).then(() => true, () => false);
  }
  return { chat, threads: list.threads, view, marked, changeCursor: chat.changeCursor };
};

export const actions: Actions = {
  chat: async ({ locals, params, request }) => {
    const form = await request.formData();
    const text = String(form.get('text') ?? '').trim();
    if (!text) return;
    try {
      await api(locals.viewer).procedure('createPost', {
        thread: params.key, textContent: text, content: { $type: 'dev.atmoboard.defs#markdown', text },
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
    redirect(303, `/t/${created.slug}/${created.key}`);
  },
};
