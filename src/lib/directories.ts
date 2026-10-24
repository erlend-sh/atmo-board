import type { ChannelView, SectionView, ViewerState } from './types';
import type { IconName } from './components/Icon.svelte';

// The sidebar's pages beside Index. A directory gathers the channels of some
// sections into one page of cards and boards; Events gathers two channels
// under tabs. Channels are matched by section name or slug, so a forum
// without them simply doesn't show the page.
export interface Directory {
  id: string; label: string; icon: IconName; description: string;
  sections: string[]; slugs?: string[];
  /** The card button, which watches the channel. */
  follow: string;
  /** Members can start one from the page (a thread in one of its channels). */
  create?: { label: string; noun: string };
}
export const DIRECTORIES: Directory[] = [
  {
    id: 'groups', label: 'Working groups', icon: 'groups', sections: ['Working Groups', 'Lexicon Community'], follow: 'Join',
    description: 'Working groups dig into one part of the protocol or ecosystem together. Join the ones you want to follow.',
  },
  {
    id: 'projects', label: 'Projects', icon: 'projects', sections: ['Projects'], slugs: ['share-your-project'], follow: 'Follow',
    description: 'Projects people build and run together for the Atmosphere. Follow the ones you want to keep up with or help on.',
    create: { label: 'New project', noun: 'project' },
  },
];
export const directory = (id: string) => DIRECTORIES.find((d) => d.id === id);

export const EVENT_TABS = [
  { id: 'upcoming', label: 'upcoming events' },
  { id: 'planning', label: 'event planning', slug: 'event-planning' },
  { id: 'meetups', label: 'regional meetups', slug: 'regional-meetups' },
] as const;
export type EventTab = (typeof EVENT_TABS)[number]['id'];

// MAIN holds pinned channels. Until members pin their own, everyone gets the
// first list and members past trust level 0 the second as well. Slugs that
// don't exist are skipped; if none match, MAIN shows every loose channel.
const PINNED = {
  everyone: ['discussion', 'resources', 'resources-learning'],
  members: ['atmosphereconf', 'community-infrastructure', 'atproto-science'],
};

const fold = (s?: string) => (s ?? '').toLowerCase();
export function directoryOf(c: ChannelView) {
  return DIRECTORIES.find((d) => d.sections.some((s) => fold(s) === fold(c.section)) || d.slugs?.includes(c.slug));
}
export function eventTabOf(c: ChannelView): EventTab | undefined {
  return EVENT_TABS.find((t) => 'slug' in t && t.slug === c.slug)?.id;
}
/** Where the sidebar files a channel: a directory id, 'events', or undefined for loose channels. */
export const placeOf = (c: ChannelView) => (eventTabOf(c) ? 'events' : directoryOf(c)?.id);

/** Channel names as the sidebar shows them: "Resources & Learning" is resources-learning. */
export const channelLabel = (c: { title: string }) => c.title.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');

export function pinnedChannels(sections: SectionView[], viewer: ViewerState) {
  const loose = sections.flatMap((s) => s.channels).filter((c) => !placeOf(c) && !c.private);
  const all = sections.flatMap((s) => s.channels);
  const slugs = [...PINNED.everyone, ...(viewer.member && (viewer.trustLevel ?? 1) > 0 ? PINNED.members : [])];
  const pinned = slugs.map((s) => all.find((c) => c.slug === s)).filter((c): c is ChannelView => !!c);
  return pinned.length ? { pinned, rest: loose.filter((c) => !pinned.includes(c)) } : { pinned: loose, rest: [] };
}
