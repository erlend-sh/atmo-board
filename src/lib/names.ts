import type { Author } from './types';

export const displayName = (a: Author) => a.displayName || a.handle || a.did.slice(0, 18) + '…';
export const handleOf = (a: Author) => (a.handle ? `@${a.handle}` : a.did);
export const initials = (a: Author) => displayName(a).replace(/^@/, '').slice(0, 1).toUpperCase();

/** A stable hue per DID, for generated avatars. */
export function hue(did: string): number {
  let h = 0;
  for (let i = 0; i < did.length; i++) h = (h * 31 + did.charCodeAt(i)) % 360;
  return h;
}

// Key first, slug after: /t/{key}/{slug}/{n}, /c/{key}/{slug}, /c/{key}/{slug}/chat.
// The key is the identity; the slug is decorative and redirects when stale.
export const threadHref = (t: { slug: string; key: string; isChannel?: boolean }, n?: number | 'last') =>
  t.isChannel ? channelHref(t) : `/t/${t.key}/${t.slug}${n ? `/${n}` : ''}`;
export const channelHref = (c: { slug: string; key: string }, chat = false) => `/c/${c.key}/${c.slug}${chat ? '/chat' : ''}`;
