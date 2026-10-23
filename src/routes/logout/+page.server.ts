import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { clearSession } from '$lib/server/session';

export const actions: Actions = {
  default: async ({ cookies }) => {
    clearSession(cookies);
    redirect(303, '/');
  },
};
