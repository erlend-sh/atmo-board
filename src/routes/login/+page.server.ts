import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { config } from '$lib/server/config';
import { writeSession } from '$lib/server/session';
import type { Author } from '$lib/types';

// Real sign-in is atproto OAuth through HappyView (milestone 2). For local
// demos, ATMOBOARD_DEV_LOGIN=1 lets you pick any member, or make up a new
// identity to try joining. Never enable it on a public instance.
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.viewer) redirect(303, '/');
  if (!config.devLogin) return { devLogin: false, members: [] as Author[] };
  const { members } = await api(null).query<{ members: Author[] }>('listMembers', { limit: 100 });
  return { devLogin: true, members };
};

export const actions: Actions = {
  member: async ({ cookies, request }) => {
    if (!config.devLogin) error(404);
    const did = String((await request.formData()).get('did') ?? '');
    if (!did.startsWith('did:')) return fail(400, { message: 'Pick a member' });
    writeSession(cookies, did);
    cookies.delete('ab_dev_handle', { path: '/' });
    redirect(303, '/');
  },
  newcomer: async ({ cookies, request }) => {
    if (!config.devLogin) error(404);
    const name = String((await request.formData()).get('name') ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    if (!name) return fail(400, { message: 'Give the newcomer a name (letters and digits)' });
    writeSession(cookies, `did:plc:${name.padEnd(24, '0')}`);
    cookies.set('ab_dev_handle', `${name}.test`, { path: '/', httpOnly: true, sameSite: 'lax', secure: false });
    redirect(303, '/');
  },
};
