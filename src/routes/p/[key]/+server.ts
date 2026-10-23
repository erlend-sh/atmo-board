import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/hv';
import { pageError } from '$lib/server/errors';

type Resolved = { kind: 'post' | 'thread' | 'channel'; key: string; slug: string; thread?: string; number?: number };

// Short permalink: /p/{key} resolves to wherever the post lives now, so it
// survives moves and renames.
export const GET: RequestHandler = async ({ locals, params }) => {
  let r: Resolved;
  try { r = await api(locals.viewer).query<Resolved>('resolveKey', { key: params.key }); } catch (e) { pageError(e); }
  if (r.kind === 'channel') redirect(302, `/c/${r.slug}/${r.key}`);
  if (r.kind === 'thread') redirect(302, `/t/${r.slug}/${r.key}`);
  // A post in a channel's untitled chat: the /t/ URL redirects on to /c/.
  redirect(302, `/t/${r.slug}/${r.thread}/${r.number}`);
};
