import type { ParamMatcher } from '@sveltejs/kit';

// /c/{slug}/{key}/chat: the channel's own untitled thread.
export const match: ParamMatcher = (param) => param === 'chat';
