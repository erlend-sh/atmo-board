import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api, groupApi } from '$lib/server/hv';
import { actionFailure, pageError } from '$lib/server/errors';
import type { Author, SectionView } from '$lib/types';

// Admins only: channels (including private ones) and the member list.
export const load: PageServerLoad = async ({ locals, parent }) => {
  const { viewer } = await parent();
  if (!viewer.permissions.admin) error(403, 'Admins only');
  try {
    const { members } = await api(locals.viewer).query<{ members: Author[] }>('listMembers', { limit: 100 });
    return { members };
  } catch (e) { pageError(e); }
};

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export const actions: Actions = {
  channel: async ({ locals, request }) => {
    const f = await request.formData();
    try {
      await groupApi().procedure('admin.putChannel', {
        actor: locals.viewer, thread: str(f, 'thread') || undefined, title: str(f, 'title'),
        description: str(f, 'description') || undefined, icon: str(f, 'icon') || undefined,
        section: str(f, 'section') || undefined, private: f.get('private') === '1' || undefined,
      });
    } catch (e) { return actionFailure(e); }
  },
  roles: async ({ locals, request }) => {
    const f = await request.formData();
    const role = str(f, 'role');
    try {
      await groupApi().procedure('admin.addMember', {
        member: str(f, 'member'), actor: locals.viewer,
        roles: role === 'member' ? ['member'] : [role, 'member'],
      });
    } catch (e) { return actionFailure(e); }
  },
  trust: async ({ locals, request }) => {
    const f = await request.formData();
    try {
      await groupApi().procedure('moderate', {
        actor: locals.viewer, action: 'setTrustLevel', subject: str(f, 'member'),
        level: Number(f.get('level')), locked: f.get('auto') !== '1',
      });
    } catch (e) { return actionFailure(e); }
  },
  remove: async ({ locals, request }) => {
    const f = await request.formData();
    try {
      await groupApi().procedure('admin.removeMember', {
        member: str(f, 'member'), actor: locals.viewer, reason: str(f, 'reason') || undefined,
      });
    } catch (e) { return actionFailure(e); }
  },
};
