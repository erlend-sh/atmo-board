import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/hv';
import { pageError } from '$lib/server/errors';
import { channelHref, threadHref } from '$lib/names';

type Resolved = { kind: 'post' | 'thread' | 'channel'; key: string; slug: string; thread?: string; number?: number };

// Short permalink: /p/{key} resolves to wherever the post lives now, so it
// survives moves and renames.
export const GET: RequestHandler = async ({ locals, params }) => {
  let r: Resolved;
  try { r = await api(locals.viewer).query<Resolved>('resolveKey', { key: params.key }); } catch (e) { pageError(e); }
  if (r.kind === 'channel') redirect(302, channelHref(r));
  if (r.kind === 'thread') redirect(302, threadHref(r));
  // A post in a channel's chat: the /t/ URL redirects on to /c/.../chat.
  redirect(302, threadHref({ key: r.thread!, slug: r.slug }, r.number));
};
