// Views returned by the dev.atmoboard.* API (see lexicons/dev/atmoboard/defs.json).
export interface Permissions { see: boolean; reply: boolean; create: boolean; moderate?: boolean; admin?: boolean }
export interface Author { did: string; handle?: string; displayName?: string; avatar?: string; roles: string[]; trustLevel?: number }
export interface ThreadState { locked: boolean; pinned: boolean; hidden: boolean }
export interface Markdown { $type: 'dev.atmoboard.defs#markdown'; text: string }
export interface ChannelView {
  key: string; uri: string; slug: string; title: string; description?: string; icon?: string; section?: string;
  position: number; private?: boolean; threadCount?: number; postCount?: number; lastActivityAt?: string; unreadCount?: number; unreadChat?: boolean;
}
export interface SectionView { name: string; channels: ChannelView[] }
export interface ThreadView {
  key: string; uri: string; slug: string; title?: string; parent?: string; isChannel?: boolean; author: Author;
  textContent?: string; content?: Markdown; tags: string[]; postCount: number; createdAt: string; updatedAt?: string;
  lastActivityAt: string; state: ThreadState; lastReadNumber?: number; participants?: Author[];
}
export interface Reaction { emoji: string; count: number; viewer?: boolean }
export interface PostView {
  key: string; uri: string; number: number; thread: string; author: Author; textContent: string; content?: Markdown;
  replyTo?: number; reactions?: Reaction[]; createdAt: string; updatedAt?: string; hidden?: boolean;
}
export interface ForumView { did: string; name: string; description?: string; joinPolicy: string }
export interface ViewerState { did?: string; handle?: string; member: boolean; roles: string[]; trustLevel?: number; permissions: Permissions }
export interface ThreadPage {
  thread: ThreadView; channel?: ChannelView; ancestors: ThreadView[]; posts: PostView[];
  hasBefore: boolean; hasAfter: boolean; permissions: Permissions; changeCursor: string;
}
