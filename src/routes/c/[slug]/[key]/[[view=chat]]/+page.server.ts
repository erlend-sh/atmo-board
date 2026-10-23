import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { actionFailure, pageError } from '$lib/server/errors';
import type { ThreadPage, ThreadView } from '$lib/types';

// A channel is a thread with a sidebar entry. Its own posts are the untitled
// chat, at /c/{slug}/{key}/chat and titled "{channel}/chat"; its child
// threads are the named threads, listed at /c/{slug}/{key} under the chat row.
export const load: PageServerLoad = async ({ locals, params, url }) => {
  const hv = api(locals.viewer);
  // ?view=chat was milestone 1's URL for the chat.
  if (url.searchParams.get('view') === 'chat') redirect(301, `/c/${params.slug}/${params.key}/chat`);
  const view = params.view === 'chat' ? 'chat' : 'threads';
  let chat: ThreadPage, list: { threads: ThreadView[]; changeCursor: string };
  try {
    [chat, list] = await Promise.all([
      hv.query<ThreadPage>('getThread', { key: params.key, anchor: 'last', before: 50, after: 0 }),
      hv.query<{ threads: ThreadView[]; changeCursor: string }>('listThreads', { parent: params.key, limit: 50 }),
    ]);
  } catch (e) { pageError(e); }
  if (!chat.thread.isChannel) redirect(301, `/t/${chat.thread.slug}/${chat.thread.key}`);
  if (chat.thread.slug !== params.slug) redirect(301, `/c/${chat.thread.slug}/${chat.thread.key}${params.view ? '/chat' : ''}${url.search}`);
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
