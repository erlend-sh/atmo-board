import { error, fail } from '@sveltejs/kit';
import { XrpcError } from './hv';

/** Turn an API error into a SvelteKit error page. */
export function pageError(e: unknown): never {
  if (e instanceof XrpcError) error(e.status === 404 ? 404 : e.status === 403 ? 403 : 502, e.message);
  throw e;
}

/** Turn an API error into a form failure the composer can show. */
export function actionFailure(e: unknown) {
  if (e instanceof XrpcError) return fail(e.status === 403 ? 403 : 400, { message: e.message });
  throw e;
}
