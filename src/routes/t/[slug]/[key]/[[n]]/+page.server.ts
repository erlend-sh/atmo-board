import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { actionFailure, pageError } from '$lib/server/errors';
import type { ThreadPage } from '$lib/types';

// /t/{slug}/{key}, /t/{slug}/{key}/{n} and /t/{slug}/{key}/last, Discourse
// style. The slug is decorative: a stale one gets a 301 to the canonical URL.
export const load: PageServerLoad = async ({ locals, params, url }) => {
  const n = params.n;
  if (n !== undefined && n !== 'last' && !/^\d+$/.test(n)) error(404, 'Not found');
  const anchor = n ?? (locals.viewer ? 'first_unread' : 'first');
  const hv = api(locals.viewer);
  let page: ThreadPage;
  try {
    page = await hv.query<ThreadPage>('getThread', { key: params.key, anchor, before: n ? 20 : undefined, after: 100 });
  } catch (e) { pageError(e); }
  const t = page.thread;
  if (t.isChannel) redirect(301, `/c/${t.slug}/${t.key}`);
  if (t.slug !== params.slug) redirect(301, `/t/${t.slug}/${t.key}${n ? `/${n}` : ''}${url.search}`);
  const last = page.posts.at(-1)?.number;
  let marked = false;
  if (locals.viewer && last && last > (t.lastReadNumber ?? 0)) {
    marked = await hv.procedure('markRead', { thread: t.key, number: last }).then(() => true, () => false);
  }
  const target = n === 'last' ? t.postCount : n ? Number(n) : anchor === 'first_unread' && (t.lastReadNumber ?? 0) > 0 ? (t.lastReadNumber ?? 0) + 1 : undefined;
  return { page, target, marked, changeCursor: page.changeCursor };
};

export const actions: Actions = {
  reply: async ({ locals, params, request }) => {
    const form = await request.formData();
    const text = String(form.get('text') ?? '').trim();
    const replyTo = String(form.get('replyTo') ?? '') || undefined;
    if (!text) return;
    try {
      await api(locals.viewer).procedure('createPost', {
        thread: params.key, replyTo, textContent: text, content: { $type: 'dev.atmoboard.defs#markdown', text },
      });
    } catch (e) { return actionFailure(e); }
  },
};
