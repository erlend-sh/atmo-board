import { error, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { api, groupApi } from '$lib/server/hv';
import type { ForumView } from '$lib/types';

// Joining an open forum: the group account writes the member's membership.
// Approval and invite forums come later.
export const actions: Actions = {
  default: async ({ cookies, locals, request }) => {
    if (!locals.viewer) redirect(303, '/login');
    const { forum } = await api(null).query<{ forum: ForumView }>('getForum');
    if (forum.joinPolicy !== 'open') error(403, 'This forum is invite only.');
    await groupApi().procedure('admin.addMember', {
      member: locals.viewer, roles: ['member'],
      // Demo newcomers have no PDS profile to read a handle from.
      handle: cookies.get('ab_dev_handle'),
    });
    redirect(303, request.headers.get('referer') ?? '/');
  },
};
