import type { SectionView } from '$lib/types';

/** Channel key → label, for showing "#channel" beside threads. */
export function channelIndex(sections: SectionView[]) {
  const out: Record<string, { title: string; slug: string; key: string; icon?: string; private?: boolean }> = {};
  for (const s of sections) for (const c of s.channels) out[c.key] = { title: c.title, slug: c.slug, key: c.key, icon: c.icon, private: c.private };
  return out;
}
