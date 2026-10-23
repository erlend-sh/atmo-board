-- atmo-board's derived tables, beside HappyView's own. Everything here can be
-- rebuilt from the records in the forum's spaces; the per-user tables (reads)
-- are private appview state and cannot. Idempotent.
BEGIN;

CREATE TABLE IF NOT EXISTS ab_config (
  k text PRIMARY KEY,
  v text
);

-- Members as the appview knows them: roles from group.opensocial.membership,
-- the trust level the appview computes, and cached identity for display.
CREATE TABLE IF NOT EXISTS ab_members (
  did          text PRIMARY KEY,
  roles        jsonb NOT NULL DEFAULT '["member"]',
  trust_level  integer NOT NULL DEFAULT 0,
  trust_locked boolean NOT NULL DEFAULT false,
  handle       text,
  display_name text,
  avatar       text,
  joined_at    text NOT NULL,
  left_at      text
);

-- Threads and posts, keyed by their 10-character key. parent_key and title
-- are the effective values after overrides (moves, renames).
CREATE TABLE IF NOT EXISTS ab_items (
  key              text PRIMARY KEY,
  uri              text NOT NULL UNIQUE,
  kind             text NOT NULL CHECK (kind IN ('thread', 'post')),
  space            text NOT NULL,
  author           text NOT NULL,
  thread_key       text,
  parent_key       text,
  title            text,
  slug             text NOT NULL DEFAULT '-',
  text             text,
  content          jsonb,
  tags             jsonb NOT NULL DEFAULT '[]',
  number           integer,
  reply_to         integer,
  created_at       text NOT NULL,
  updated_at       text,
  last_activity_at text,
  post_count       integer NOT NULL DEFAULT 0,
  locked           boolean NOT NULL DEFAULT false,
  resolved         boolean NOT NULL DEFAULT false,
  pinned           boolean NOT NULL DEFAULT false,
  hidden           boolean NOT NULL DEFAULT false,
  deleted          boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS ab_items_threads ON ab_items (parent_key, last_activity_at DESC) WHERE kind = 'thread';
CREATE UNIQUE INDEX IF NOT EXISTS ab_items_posts ON ab_items (thread_key, number) WHERE kind = 'post';

-- Sidebar entries: the threads promoted to channels.
CREATE TABLE IF NOT EXISTS ab_channels (
  thread_key  text PRIMARY KEY REFERENCES ab_items (key),
  uri         text NOT NULL,
  section     text,
  position    integer NOT NULL DEFAULT 0,
  icon        text,
  description text,
  private     boolean NOT NULL DEFAULT false
);

-- Discourse category security: which groups may See, Reply or Create in a
-- channel. No rows for a channel means everyone sees and members post.
CREATE TABLE IF NOT EXISTS ab_channel_access (
  channel_key text NOT NULL REFERENCES ab_items (key),
  grp         text NOT NULL,
  level       text NOT NULL CHECK (level IN ('see', 'reply', 'create')),
  PRIMARY KEY (channel_key, grp)
);

CREATE TABLE IF NOT EXISTS ab_reactions (
  uri        text PRIMARY KEY,
  post_key   text NOT NULL,
  author     text NOT NULL,
  emoji      text NOT NULL,
  created_at text NOT NULL,
  UNIQUE (post_key, author, emoji)
);

-- Private per-member state: how far each member has read each thread.
CREATE TABLE IF NOT EXISTS ab_reads (
  did        text NOT NULL,
  thread_key text NOT NULL,
  last_read  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (did, thread_key)
);

-- The ordered change log getChanges serves to polling clients.
CREATE TABLE IF NOT EXISTS ab_changes (
  seq        bigserial PRIMARY KEY,
  kind       text NOT NULL,
  key        text NOT NULL,
  thread_key text,
  parent_key text,
  at         timestamptz NOT NULL DEFAULT now()
);

COMMIT;
