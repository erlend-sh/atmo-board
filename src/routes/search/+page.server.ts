import type { PageServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { pageError } from '$lib/server/errors';
import type { PostHit } from '$lib/types';

// /search?q=…, optionally narrowed with author= (a DID) and thread= (a key).
export const load: PageServerLoad = async ({ locals, url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';
  const author = url.searchParams.get('author') || undefined;
  const thread = url.searchParams.get('thread') || undefined;
  const cursor = url.searchParams.get('cursor') || undefined;
  if (!q && !author && !thread) return { q, hits: [] as PostHit[], cursor: undefined, searched: false };
  try {
    const res = await api(locals.viewer).query<{ hits: PostHit[]; cursor?: string }>('listPosts', { q, author, thread, cursor, limit: 25 });
    return { q, hits: res.hits, cursor: res.cursor, searched: true };
  } catch (e) { pageError(e); }
};
