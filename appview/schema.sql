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

-- Earlier versions of edited posts (edit history). Version 1 is the
-- original; the current text lives in ab_items. Dropped on author delete.
CREATE TABLE IF NOT EXISTS ab_revisions (
  key        text NOT NULL,
  version    int  NOT NULL,
  title      text,
  text       text,
  content    jsonb,
  created_at text NOT NULL,
  PRIMARY KEY (key, version)
);

-- Per-member thread notification level: watching, normal (no row) or muted.
CREATE TABLE IF NOT EXISTS ab_follows (
  did        text NOT NULL,
  thread_key text NOT NULL,
  level      text NOT NULL CHECK (level IN ('watching', 'muted')),
  PRIMARY KEY (did, thread_key)
);

ALTER TABLE ab_items ADD COLUMN IF NOT EXISTS edit_count int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS ab_items_search ON ab_items
  USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(text, '')));

-- Whispers: staff-only posts, written to the staff space. They take post
-- numbers like any post; last_public is the highest number non-staff can see.
ALTER TABLE ab_items ADD COLUMN IF NOT EXISTS whisper boolean NOT NULL DEFAULT false;
ALTER TABLE ab_items ADD COLUMN IF NOT EXISTS last_public int NOT NULL DEFAULT 0;
UPDATE ab_items t SET last_public = t.post_count
  WHERE t.kind = 'thread' AND t.last_public = 0 AND t.post_count > 0
    AND NOT EXISTS (SELECT 1 FROM ab_items w WHERE w.thread_key = t.key AND w.whisper);
-- Who hid an item: 'staff' (an override) or 'flags' (community reports).
ALTER TABLE ab_items ADD COLUMN IF NOT EXISTS hidden_by text;

-- Overrides the group has applied (move, rename, hide, lock, pin, trust
-- levels): the moderation log. The records themselves live in the main space.
CREATE TABLE IF NOT EXISTS ab_overrides (
  uri         text PRIMARY KEY,
  subject     text NOT NULL,
  action      text NOT NULL,
  actor       text,
  reason      text,
  detail      jsonb,
  created_at  text NOT NULL
);
CREATE INDEX IF NOT EXISTS ab_overrides_subject ON ab_overrides (subject, created_at);

-- Reports (Discourse flags). Private host state, as in the opensocial
-- proposal's moderation queue: one row per reporter per subject.
CREATE TABLE IF NOT EXISTS ab_reports (
  subject_key text NOT NULL,
  reporter    text NOT NULL,
  reason      text NOT NULL,
  note        text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'agreed', 'disagreed', 'ignored')),
  created_at  text NOT NULL,
  resolved_by text,
  resolved_at text,
  PRIMARY KEY (subject_key, reporter)
);

-- Private trust-level inputs, per member per day: Discourse's days visited,
-- posts read and topics entered. Never published; only the level is.
CREATE TABLE IF NOT EXISTS ab_activity (
  did            text NOT NULL,
  day            date NOT NULL DEFAULT current_date,
  posts_read     int NOT NULL DEFAULT 0,
  topics_entered int NOT NULL DEFAULT 0,
  PRIMARY KEY (did, day)
);

-- Removed columns (kept as drops so existing databases converge).
ALTER TABLE ab_items DROP COLUMN IF EXISTS resolved;

COMMIT;
