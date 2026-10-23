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

export const threadHref = (t: { slug: string; key: string; isChannel?: boolean }, n?: number) =>
  t.isChannel ? `/c/${t.slug}/${t.key}` : `/t/${t.slug}/${t.key}${n ? `/${n}` : ''}`;
