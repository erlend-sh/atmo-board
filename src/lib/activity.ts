import type { Author, PostView } from './types';

/** How many people wrote in these posts this past week. */
export const recentlyActive = (posts: PostView[], now = Date.now()) =>
  new Set(posts.filter((p) => now - Date.parse(p.createdAt) < 7 * 86_400_000).map((p) => p.author.did)).size;

/** The latest posters, newest first, for a chat row's faces. */
export const latestPeople = (posts: PostView[], n = 5): Author[] =>
  [...new Map(posts.toReversed().map((p) => [p.author.did, p.author])).values()].slice(0, n);
