import { error, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { api, groupApi } from '$lib/server/hv';
import { readHandle } from '$lib/server/session';
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
      // The handle they signed in with (verified against their DID document).
      handle: readHandle(cookies),
    });
    redirect(303, request.headers.get('referer') ?? '/');
  },
};
