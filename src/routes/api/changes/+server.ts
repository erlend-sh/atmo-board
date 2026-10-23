import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/hv';

// The Poller's endpoint: a thin proxy to getChanges.
export const GET: RequestHandler = async ({ locals, url }) => {
  const q = url.searchParams;
  const res = await api(locals.viewer).query('getChanges', {
    since: q.get('since') ?? '0', thread: q.get('thread'), parent: q.get('parent'),
  });
  return json(res, { headers: { 'cache-control': 'no-store' } });
};
