import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import type { Author } from '$lib/types';

// A minimal member page until getMember lands (milestone 2).
export const load: PageServerLoad = async ({ locals, params }) => {
  const { members } = await api(locals.viewer).query<{ members: Author[] }>('listMembers', { limit: 100 });
  const member = members.find((m) => m.handle === params.actor || m.did === params.actor);
  if (!member) error(404, 'No such member');
  return { member };
};
