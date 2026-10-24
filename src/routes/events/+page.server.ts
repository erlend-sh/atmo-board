import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { createThread, postActions } from '$lib/server/postActions';
import { EVENT_TABS, eventTabOf, type EventTab } from '$lib/directories';
import type { ThreadPage, ThreadView } from '$lib/types';

// /events: upcoming events, then a tab per events channel (planning,
// regional meetups) showing that channel's board.
export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const { sections } = await parent();
  const channels = sections.flatMap((s) => s.channels).filter((c) => eventTabOf(c));
  const tabs = EVENT_TABS.filter((t) => t.id === 'upcoming' || channels.some((c) => eventTabOf(c) === t.id)).map((t) => t.id);
  const asked = url.searchParams.get('tab') as EventTab | null;
  const tab = asked && tabs.includes(asked) ? asked : 'upcoming';
  const channel = channels.find((c) => eventTabOf(c) === tab);
  if (!channel) return { tab, tabs, channel: null, chat: null, threads: [] as ThreadView[] };
  const hv = api(locals.viewer);
  const [chat, list] = await Promise.all([
    hv.query<ThreadPage>('getThread', { key: channel.key, anchor: 'last', before: 50, after: 0 }),
    hv.query<{ threads: ThreadView[] }>('listThreads', { parent: channel.key, limit: 50 }),
  ]);
  return { tab, tabs, channel, chat, threads: list.threads };
};

export const actions: Actions = {
  notify: postActions.notify,
  thread: (e) => createThread(e),
};
