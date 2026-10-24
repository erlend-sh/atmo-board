import type { Author } from './types';

// Upcoming events on the Events page. A fixed list for now, gathered from
// Smoke Signal and OpenMeet in October 2026; past events drop off by themselves.
export interface ForumEvent { title: string; at: string; place: string; mode: string; by: string; description: string }

export const EVENTS: ForumEvent[] = [
  { title: 'atproto.la hangout October', at: '2026-10-25T19:00Z', place: 'Bike Shed Moto Co, Los Angeles, CA', mode: 'in person', by: 'atproto.la',
    description: 'An informal hangout for people interested in open social web protocols. No planned talks, just good conversation.' },
  { title: 'Colorado Atproto Meetup', at: '2026-10-29T00:00Z', place: 'Arvada, CO', mode: 'in person', by: 'colorado.atprotocol.space',
    description: 'An overview of a few AT Protocol topics, then open discussion. Pizza and drinks provided.' },
  { title: 'atproto.la gathering November 2026', at: '2026-11-08T19:00Z', place: 'Crash Space, Culver City, CA', mode: 'in person', by: 'atproto.la',
    description: 'A community gathering about open protocols. Activities to be decided.' },
  { title: 'atproto Vienna meetup', at: '2026-11-09T17:00Z', place: 'Wien, Austria', mode: 'in person', by: 'atproto.wien',
    description: 'The fourth Vienna meetup on atproto and the open social web. Agenda to follow.' },
  { title: 'November Brewery Meetup', at: '2026-11-13T00:00Z', place: 'Boston, MA', mode: 'in person', by: 'atproto.boston',
    description: 'The monthly atproto meetup. Details to be announced.' },
  { title: 'IETF 127 San Francisco', at: '2026-11-14T17:00Z', place: 'San Francisco, CA', mode: 'in person + online', by: 'atmosphere.community',
    description: 'IETF 127, with a free onsite hackathon on Nov 14–15 (registration required). Community planning happens in #event-planning.' },
  { title: 'IETF 127 Hackathon', at: '2026-11-14T18:00Z', place: 'San Francisco, CA', mode: 'in person + online', by: 'bayarea.atproto.camp',
    description: 'A hackathon for building with IETF standards and technologies.' },
  { title: 'IETF127 atp meeting', at: '2026-11-18T16:00Z', place: 'San Francisco, CA', mode: 'in person + online', by: 'atmosphere.community',
    description: 'The atp working group session at IETF 127. In-person attendance needs a day or week ticket; remote participation is free with a waiver.' },
  { title: 'December Brewery Meetup', at: '2026-12-11T00:00Z', place: 'Boston, MA', mode: 'in person', by: 'atproto.boston',
    description: 'The monthly atproto meetup. Details to be announced.' },
  { title: 'atproto.la gathering December 2026', at: '2026-12-13T19:00Z', place: 'Crash Space, Culver City, CA', mode: 'in person', by: 'atproto.la',
    description: 'A community gathering about open protocols. Activities to be decided.' },
  { title: 'atproto Vienna meetup (5th)', at: '2026-12-14T17:00Z', place: 'Wien, Austria', mode: 'in person', by: 'atproto.wien',
    description: 'The fifth Vienna atproto meetup. Agenda to follow.' },
  { title: 'FOSDEM 2027', at: '2027-01-30T16:00Z', place: 'Brussels, Belgium', mode: 'in person', by: 'atmosphere.community',
    description: 'FOSDEM 2027 dates are set. Volunteers can help organise a dev room, socials or other gatherings in #event-planning.' },
  { title: 'IETF 129 Berlin', at: '2027-07-17T07:00Z', place: 'Berlin, Germany', mode: 'in person + online', by: 'atmosphere.community',
    description: 'Planned dates for IETF 129. More details to come.' },
];

/** An organizer as an avatar author: events carry only a handle. */
export const host = (handle: string): Author => ({ did: `handle:${handle}`, handle, roles: [] });
