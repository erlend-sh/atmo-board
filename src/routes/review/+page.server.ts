import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api, groupApi } from '$lib/server/hv';
import { actionFailure, pageError } from '$lib/server/errors';
import type { ReviewItem } from '$lib/types';

// Discourse's /review: the flags staff haven't settled yet.
export const load: PageServerLoad = async ({ locals, url }) => {
  const status = url.searchParams.get('status') === 'all' ? 'all' : 'open';
  try {
    const res = await api(locals.viewer).query<{ items: ReviewItem[]; cursor?: string }>('getReviewQueue', { status, limit: 50 });
    return { items: res.items, status };
  } catch (e) { pageError(e); }
};

export const actions: Actions = {
  resolve: async ({ locals, request }) => {
    const form = await request.formData();
    const subject = String(form.get('subject') ?? '');
    const status = String(form.get('status') ?? '');
    const hide = form.get('hide') === '1';
    try {
      const hv = api(locals.viewer);
      // Agreeing with a flag usually means hiding the post as well.
      if (hide) await groupApi().procedure('moderate', { actor: locals.viewer, action: 'hide', subject, reason: 'flagged' });
      await hv.procedure('resolveReport', { subject, status });
    } catch (e) { return actionFailure(e); }
  },
};
