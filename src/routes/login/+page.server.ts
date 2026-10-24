import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { config } from '$lib/server/config';
import { writeHandle, writeSession } from '$lib/server/session';
import { OAuthConfigurationError, SCOPE, oauthClient, safeNext } from '$lib/server/oauth';
import type { Author } from '$lib/types';

// Sign-in is atproto OAuth through HappyView's SDK: enter a handle, approve
// at your PDS, come back to /oauth/callback. For local demos,
// ATMOBOARD_DEV_LOGIN=1 also lets you pick any member, or make up a new
// identity to try joining. Never enable it on a public instance.
export const load: PageServerLoad = async ({ locals, url }) => {
  const next = safeNext(url.searchParams.get('next'));
  if (locals.viewer) redirect(303, next ?? '/');
  if (!config.devLogin) return { devLogin: false, members: [] as Author[], next };
  const { members } = await api(null).query<{ members: Author[] }>('listMembers', { limit: 100 });
  return { devLogin: true, members, next };
};

export const actions: Actions = {
  oauth: async ({ cookies, request }) => {
    const form = await request.formData();
    const handle = String(form.get('handle') ?? '').trim().replace(/^@/, '').toLowerCase();
    if (!handle) return fail(400, { message: 'Enter your handle, like alice.bsky.social', handle });
    let to: URL;
    try {
      to = await oauthClient().authorize(handle, { scope: SCOPE, cookies, context: { next: safeNext(form.get('next')), handle } });
    } catch (e) {
      // SDK and network errors can carry upstream bodies; don't reflect them.
      const message = e instanceof OAuthConfigurationError ? e.message : 'Could not start sign-in. Check your handle and try again.';
      return fail(502, { message, handle });
    }
    redirect(303, to.toString());
  },
  member: async ({ cookies, request }) => {
    if (!config.devLogin) error(404);
    const form = await request.formData();
    const did = String(form.get('did') ?? '');
    if (!did.startsWith('did:')) return fail(400, { message: 'Pick a member' });
    writeSession(cookies, did);
    writeHandle(cookies, undefined);
    redirect(303, safeNext(form.get('next')) ?? '/');
  },
  newcomer: async ({ cookies, request }) => {
    if (!config.devLogin) error(404);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    if (!name) return fail(400, { message: 'Give the newcomer a name (letters and digits)' });
    writeSession(cookies, `did:plc:${name.padEnd(24, '0')}`);
    writeHandle(cookies, `${name}.test`);
    redirect(303, safeNext(form.get('next')) ?? '/');
  },
};
