import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oauthClient, safeNext } from '$lib/server/oauth';
import { writeHandle, writeSession } from '$lib/server/session';

// The PDS sends people back here. The OAuth wrapper checks the browser, the
// issuer and the account before HappyView registers the session; then the
// verified DID becomes this browser's session.
export const GET: RequestHandler = async ({ url, cookies }) => {
  let result;
  try {
    result = await oauthClient().callback(url.searchParams, cookies);
  } catch {
    // Don't reflect upstream token bodies, codes or SDK errors.
    error(400, 'Sign-in could not be verified. Go back to the sign-in page and start again.');
  }
  writeSession(cookies, result.session.did);
  writeHandle(cookies, result.context.handle);
  redirect(303, safeNext(result.context.next) ?? '/');
};
