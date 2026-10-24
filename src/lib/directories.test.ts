import { describe, expect, it } from 'vitest';
import { channelLabel, directoryOf, eventTabOf, pinnedChannels, placeOf } from './directories';
import type { ChannelView, SectionView, ViewerState } from './types';

const ch = (title: string, section: string, extra: Partial<ChannelView> = {}): ChannelView => ({
  key: title.slice(0, 10).padEnd(10, 'a'), uri: '', slug: channelLabel({ title }), title, section, position: 0, ...extra,
});
const sections: SectionView[] = [
  { name: 'Community', channels: [ch('Discussion', 'Community'), ch('Resources & Learning', 'Community'), ch('ATmosphereConf', 'Community'),
    ch('Event Planning', 'Community'), ch('Share your project', 'Community')] },
  { name: 'Lexicon Community', channels: [ch('ATGeo', 'Lexicon Community')] },
  { name: 'Projects', channels: [ch('Community Infrastructure', 'Projects')] },
  { name: 'Private', channels: [ch('Staff', 'Private', { private: true })] },
];
const viewer = (trustLevel?: number, member = true): ViewerState => ({ member, roles: [], trustLevel, permissions: { see: true, reply: true, create: true } });

describe('directories', () => {
  it('files channels by section or slug', () => {
    const [community, lexicon, projects] = sections;
    expect(directoryOf(lexicon.channels[0])?.id).toBe('groups');
    expect(directoryOf(projects.channels[0])?.id).toBe('projects');
    expect(placeOf(community.channels[4])).toBe('projects');
    expect(eventTabOf(community.channels[3])).toBe('planning');
    expect(placeOf(community.channels[0])).toBeUndefined();
  });

  it('labels channels the way the sidebar shows them', () => {
    expect(channelLabel({ title: 'Resources & Learning' })).toBe('resources-learning');
    expect(channelLabel({ title: 'WG Private Data' })).toBe('wg-private-data');
  });

  it('pins more channels for members past trust level 0', () => {
    const slugs = (v: ViewerState) => pinnedChannels(sections, v).pinned.map((c) => c.slug);
    expect(slugs(viewer(undefined, false))).toEqual(['discussion', 'resources-learning']);
    expect(slugs(viewer(0))).toEqual(['discussion', 'resources-learning']);
    expect(slugs(viewer(2))).toEqual(['discussion', 'resources-learning', 'atmosphereconf', 'community-infrastructure']);
    expect(pinnedChannels(sections, viewer(0)).rest.map((c) => c.slug)).toEqual(['atmosphereconf']);
  });

  it('falls back to every loose public channel when no pin matches', () => {
    const other: SectionView[] = [{ name: '', channels: [ch('General', ''), ch('Mods', '', { private: true })] }];
    expect(pinnedChannels(other, viewer(2)).pinned.map((c) => c.slug)).toEqual(['general']);
  });
});
