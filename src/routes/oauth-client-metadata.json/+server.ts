import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clientMetadata } from '$lib/server/oauth';

// The OAuth client_id document for public (https) deployments.
export const GET: RequestHandler = () => json(clientMetadata());
