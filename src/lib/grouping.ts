import type { PostView } from './types';

/** Chat-style grouping: consecutive posts by one author within 5 minutes share a header. */
export function grouped(posts: PostView[]) {
  return posts.map((post, i) => {
    const prev = posts[i - 1];
    const compact = !!prev && prev.author.did === post.author.did && !post.replyTo
      && Date.parse(post.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
    return { post, compact };
  });
}
