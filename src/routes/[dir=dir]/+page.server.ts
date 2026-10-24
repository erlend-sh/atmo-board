import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { channelIndex } from '$lib/server/channels';
import { createThread, postActions } from '$lib/server/postActions';
import { directory, directoryOf } from '$lib/directories';
import type { ThreadPage, ThreadView } from '$lib/types';

const SORTS = ['overview', 'latest', 'unread', 'top'];

// A directory: cards for its channels (Overview), or one board of all their
// threads. listThreads takes one parent, so a board asks each channel and
// merges: by last activity, or for Top by post count.
export const load: PageServerLoad = async ({ locals, parent, params, url }) => {
  const dir = directory(params.dir)!;
  const sort = SORTS.includes(url.searchParams.get('sort') ?? '') ? url.searchParams.get('sort')! : 'overview';
  const { sections } = await parent();
  const channels = sections.flatMap((s) => s.channels).filter((c) => directoryOf(c)?.id === dir.id);
  if (!channels.length) error(404, 'Not found');
  const hv = api(locals.viewer);
  if (sort === 'overview') {
    // Each channel's own thread says whether the viewer follows it.
    const levels = locals.viewer
      ? await Promise.all(channels.map((c) => hv.query<ThreadPage>('getThread', { key: c.key, anchor: 'last', before: 0, after: 0 })
        .then((p) => p.thread.notificationLevel, () => undefined)))
      : [];
    return { dir: dir.id, sort, channels: channels.map((c, i) => ({ ...c, level: levels[i] })), threads: [], index: {} };
  }
  const lists = await Promise.all(channels.map((c) => hv.query<{ threads: ThreadView[] }>('listThreads', { parent: c.key, sort, limit: 50 })
    .then((r) => r.threads, () => [] as ThreadView[])));
  const threads = lists.flat().sort(sort === 'top'
    ? (a, b) => b.postCount - a.postCount
    : (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)).slice(0, 50);
  return { dir: dir.id, sort, channels: channels.map((c) => ({ ...c, level: undefined })), threads, index: channelIndex(sections) };
};

export const actions: Actions = {
  notify: postActions.notify,
  thread: (e) => createThread(e),
};
