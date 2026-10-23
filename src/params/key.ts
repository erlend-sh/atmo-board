import type { ParamMatcher } from '@sveltejs/kit';

// A record key: 10 lowercase base32 characters of sha256(at-uri).
export const match: ParamMatcher = (param) => /^[a-z2-7]{10}$/.test(param);
