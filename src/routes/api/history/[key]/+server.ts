import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api, XrpcError } from '$lib/server/hv';

// A post's edit history, fetched when someone opens the "edited" marker.
export const GET: RequestHandler = async ({ locals, params }) => {
  try {
    return json(await api(locals.viewer).query('getPostHistory', { key: params.key }));
  } catch (e) {
    if (e instanceof XrpcError) return json({ error: e.name, message: e.message }, { status: e.status });
    throw e;
  }
};
