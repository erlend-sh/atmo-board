import type { PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { channelIndex } from '$lib/server/channels';
import type { ThreadView } from '$lib/types';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const sort = url.searchParams.get('sort') ?? 'latest';
  const [{ sections }, list] = await Promise.all([
    parent(),
    api(locals.viewer).query<{ threads: ThreadView[]; changeCursor: string }>('listThreads', { sort, limit: 50 }),
  ]);
  return { threads: list.threads, changeCursor: list.changeCursor, channels: channelIndex(sections), sort };
};
