import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/hv';
import { EXPECTED_HAPPYVIEW } from '$lib/server/config';

// The healthcheck: the app is up, and HappyView answers. Deliberately thin,
// and it exposes nothing but the version the app was built against.
export const GET: RequestHandler = async () => {
  const appview = await api(null).query<unknown>('getForum').then(() => 'ok', () => 'unreachable');
  return json({ status: appview === 'ok' ? 'ok' : 'degraded', appview, happyview: EXPECTED_HAPPYVIEW },
    { status: appview === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } });
};
