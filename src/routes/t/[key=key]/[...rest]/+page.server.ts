import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { actionFailure, pageError } from '$lib/server/errors';
import type { ThreadPage } from '$lib/types';
import { channelHref, threadHref } from '$lib/names';
import { postActions } from '$lib/server/postActions';

// /t/{key}/{slug}, /t/{key}/{slug}/{n} and /t/{key}/{slug}/last. The key is
// the identity; the slug is decorative, may be missing (/t/{key}/{n} works),
// and a stale one gets a 301 to the canonical URL.
function parse(rest: string) {
  const parts = rest.split('/').filter(Boolean);
  const isPos = (s?: string) => s === 'last' || /^\d+$/.test(s ?? '');
  const n = isPos(parts.at(-1)) ? parts.pop() : undefined;
  if (parts.length > 1) error(404, 'Not found');
  return { slug: parts[0], n };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const { slug, n } = parse(params.rest);
  const anchor = n ?? (locals.viewer ? 'first_unread' : 'first');
  const hv = api(locals.viewer);
  let page: ThreadPage;
  try {
    page = await hv.query<ThreadPage>('getThread', { key: params.key, anchor, before: n ? 20 : undefined, after: 100 });
  } catch (e) { pageError(e); }
  const t = page.thread;
  if (t.isChannel) redirect(301, channelHref(t, true));
  if (t.slug !== slug) redirect(301, threadHref(t, n as number | 'last' | undefined) + url.search);
  const last = page.posts.at(-1)?.number;
  let marked = false;
  if (locals.viewer && last && last > (t.lastReadNumber ?? 0)) {
    marked = await hv.procedure('markRead', { thread: t.key, number: last }).then(() => true, () => false);
  }
  const target = n === 'last' ? t.postCount : n ? Number(n) : anchor === 'first_unread' && (t.lastReadNumber ?? 0) > 0 ? (t.lastReadNumber ?? 0) + 1 : undefined;
  return { page, target, marked, changeCursor: page.changeCursor };
};

export const actions: Actions = {
  ...postActions,
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
