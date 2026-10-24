import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { clearSession } from '$lib/server/session';
import { oauthClient } from '$lib/server/oauth';

export const actions: Actions = {
  default: async ({ cookies, locals }) => {
    // Revoke the HappyView session when there is one (dev logins have none).
    if (locals.viewer) try { await oauthClient().revoke(locals.viewer); } catch { /* nothing to revoke */ }
    clearSession(cookies);
    redirect(303, '/');
  },
};
