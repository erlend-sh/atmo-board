import type { LayoutServerLoad } from './$types';
import { api } from '$lib/server/hv';
import { config } from '$lib/server/config';
import type { ForumView, SectionView, ViewerState } from '$lib/types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
  // Pages that mark something read invalidate this, so unread badges update.
  depends('app:sidebar');
  const hv = api(locals.viewer);
  const [{ forum, viewer }, sidebar] = await Promise.all([
    hv.query<{ forum: ForumView; viewer: ViewerState }>('getForum'),
    hv.query<{ sections: SectionView[]; cursor: string }>('getSidebar'),
  ]);
  return { forum, viewer, sections: sidebar.sections, sidebarCursor: sidebar.cursor, devLogin: config.devLogin };
};
