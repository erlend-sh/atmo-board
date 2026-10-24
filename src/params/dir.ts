import type { ParamMatcher } from '@sveltejs/kit';
import { directory } from '$lib/directories';

// A directory page: /groups, /projects.
export const match: ParamMatcher = (param) => !!directory(param);
