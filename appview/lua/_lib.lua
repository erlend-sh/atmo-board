-- Shared prelude for every atmo-board script. setup.sh prepends this file to
-- each endpoint script before uploading it, because HappyView scripts cannot
-- require one another.

local NS = "dev.atmoboard"
local OS = "group.opensocial"
local SPACE_TYPE = NS .. ".forum"

-- ---------------------------------------------------------------- helpers

-- db.raw stops reading parameters at the first nil, so a nil can't be bound.
-- exec takes packed arguments (P(...) keeps their count) and inlines NULL for
-- each nil, renumbering the rest. Note db.raw binds booleans as 1/0.
local P = table.pack
local function exec(sql, args)
  if not args then return db.raw(sql) end
  local map, bound, next_index = {}, {}, 0
  for k = 1, args.n or #args do
    if args[k] == nil then
      map[k] = "NULL"
    else
      next_index = next_index + 1
      map[k] = "$" .. next_index
      bound[next_index] = args[k]
    end
  end
  sql = string.gsub(sql, "%$(%d+)", function(d) return map[tonumber(d)] or ("$" .. d) end)
  return db.raw(sql, bound)
end

local function one(sql, args)
  local rows = exec(sql, args)
  return rows[1]
end

local function config(k)
  local row = one("SELECT v FROM ab_config WHERE k = $1", { k })
  return row and row.v or nil
end

local function set_config(k, v)
  exec("INSERT INTO ab_config (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = $2", P(k, v))
end

local function fail(name, message)
  return { error = name, message = message or name }
end

-- Lowercase RFC 4648 base32 of the first 50 bits of sha256(uri): ten
-- characters, stable for as long as the record's at-uri is.
local B32 = "abcdefghijklmnopqrstuvwxyz234567"
local function key_for(uri)
  local hex = one("SELECT encode(sha256(convert_to($1, 'UTF8')), 'hex') AS h", { uri }).h
  local n = tonumber(string.sub(hex, 1, 13), 16) >> 2 -- 52 bits down to 50
  local out = {}
  for i = 10, 1, -1 do
    local d = n & 31
    out[i] = string.sub(B32, d + 1, d + 1)
    n = n >> 5
  end
  return table.concat(out)
end

-- Discourse-style slug: lowercase ASCII words joined by hyphens. Decorative
-- only; URLs resolve by key and redirect a stale slug.
local function slugify(title)
  if not title or title == "" then return "-" end
  local s = string.lower(title)
  s = string.gsub(s, "[^%w]+", "-")
  s = string.gsub(s, "^%-+", "")
  s = string.gsub(s, "%-+$", "")
  if #s > 60 then s = string.gsub(string.sub(s, 1, 60), "%-[^%-]*$", "") end
  if s == "" then return "-" end
  return s
end

local function truthy(v) return v == true or v == "t" or v == "true" or v == 1 end

local function decode(v)
  if type(v) == "string" then return json.decode(v) end
  return v
end

local function log_change(kind, item_key, thread_key, parent_key)
  exec("INSERT INTO ab_changes (kind, key, thread_key, parent_key) VALUES ($1, $2, $3, $4)",
    P(kind, item_key, thread_key, parent_key))
end

local function change_cursor()
  local row = one("SELECT COALESCE(max(seq), 0)::text AS seq FROM ab_changes")
  return row.seq
end

-- ---------------------------------------------------------------- the group

local function forum_did() return config("forum_did") end

local function member_row(did)
  if not did then return nil end
  return one("SELECT did, roles::text AS roles, trust_level, handle, display_name, avatar FROM ab_members WHERE did = $1 AND left_at IS NULL", { did })
end

local function roles_of(row)
  if not row then return {} end
  return decode(row.roles) or {}
end

local function has_role(roles, want)
  for _, r in ipairs(roles) do if r == want then return true end end
  return false
end

local function is_staff(roles) return has_role(roles, "admin") or has_role(roles, "moderator") end

-- The groups a viewer belongs to for permission purposes, Discourse style:
-- everyone, members, trust_level_0..N, their roles, and staff.
local function groups_of(did)
  local groups = { "everyone" }
  local m = member_row(did)
  if m then
    table.insert(groups, "members")
    local tl = tonumber(m.trust_level) or 0
    for i = 0, tl do table.insert(groups, "trust_level_" .. i) end
    local roles = roles_of(m)
    for _, r in ipairs(roles) do table.insert(groups, r) end
    if is_staff(roles) then table.insert(groups, "staff") end
  end
  return groups, m
end

local LEVEL = { see = 1, reply = 2, create = 3 }

-- Discourse category security: each channel grants groups See, Reply or
-- Create. A channel with no rows uses the default: everyone sees, members
-- reply and create. Staff can always do everything; admins administer.
local function permissions(did, channel_key)
  local groups, m = groups_of(did)
  local roles = roles_of(m)
  local staff = is_staff(roles)
  local best = 0
  local rows = channel_key and exec("SELECT grp, level FROM ab_channel_access WHERE channel_key = $1", P(channel_key)) or {}
  if #rows == 0 then
    best = m and LEVEL.create or LEVEL.see
  else
    local mine = {}
    for _, g in ipairs(groups) do mine[g] = true end
    for _, r in ipairs(rows) do
      if mine[r.grp] and LEVEL[r.level] > best then best = LEVEL[r.level] end
    end
  end
  if staff then best = LEVEL.create end
  return {
    see = best >= LEVEL.see,
    reply = m ~= nil and best >= LEVEL.reply,
    create = m ~= nil and best >= LEVEL.create,
    moderate = staff,
    admin = has_role(roles, "admin"),
  }
end

-- ---------------------------------------------------------------- items

local ITEM_COLS = [[
  i.key, i.uri, i.kind, i.space, i.author, i.thread_key, i.parent_key, i.title, i.slug,
  i.text, i.content::text AS content, i.tags::text AS tags, i.number, i.reply_to,
  i.created_at, i.updated_at, i.last_activity_at, i.post_count,
  i.locked, i.pinned, i.hidden,
  m.handle AS author_handle, m.display_name AS author_name, m.avatar AS author_avatar,
  m.roles::text AS author_roles, m.trust_level AS author_tl,
  c.thread_key IS NOT NULL AS is_channel
]]
local ITEM_FROM = [[
  FROM ab_items i
  LEFT JOIN ab_members m ON m.did = i.author
  LEFT JOIN ab_channels c ON c.thread_key = i.key
]]

local function get_item(k)
  return one("SELECT " .. ITEM_COLS .. ITEM_FROM .. " WHERE i.key = $1 AND NOT i.deleted", { k })
end

-- The channel an item lives under: walk parents up to the top-level thread.
local function channel_of(item)
  local k = item.kind == "post" and item.thread_key or item.key
  for _ = 1, 8 do
    local row = one("SELECT key, parent_key FROM ab_items WHERE key = $1", { k })
    if not row then return nil end
    if not row.parent_key then return row.key end
    k = row.parent_key
  end
  return k
end

local function author_view(row)
  local v = { did = row.author }
  if row.author_handle then v.handle = row.author_handle end
  if row.author_name then v.displayName = row.author_name end
  if row.author_avatar then v.avatar = row.author_avatar end
  v.roles = toarray(decode(row.author_roles) or {})
  if row.author_tl then v.trustLevel = tonumber(row.author_tl) end
  return v
end

local function markdown_of(row)
  local c = decode(row.content)
  if c and c["$type"] then return c end
  return nil
end

local function thread_view(row, viewer)
  local v = {
    key = row.key, uri = row.uri, slug = row.slug, author = author_view(row),
    postCount = tonumber(row.post_count) or 0,
    createdAt = row.created_at, lastActivityAt = row.last_activity_at or row.created_at,
    isChannel = truthy(row.is_channel),
    tags = toarray(decode(row.tags) or {}),
    state = { locked = truthy(row.locked), pinned = truthy(row.pinned), hidden = truthy(row.hidden) },
  }
  if row.title and row.title ~= "" then v.title = row.title end
  if row.parent_key then v.parent = row.parent_key end
  if row.text and row.text ~= "" then v.textContent = row.text end
  local md = markdown_of(row)
  if md then v.content = md end
  if row.updated_at then v.updatedAt = row.updated_at end
  if viewer then
    local r = one("SELECT last_read FROM ab_reads WHERE did = $1 AND thread_key = $2", { viewer, row.key })
    if r then v.lastReadNumber = tonumber(r.last_read) end
  end
  return v
end

local function post_view(row, viewer)
  local v = {
    key = row.key, uri = row.uri, number = tonumber(row.number), thread = row.thread_key,
    author = author_view(row), textContent = row.text or "", createdAt = row.created_at,
  }
  local md = markdown_of(row)
  if md then v.content = md end
  if row.reply_to then v.replyTo = tonumber(row.reply_to) end
  if row.updated_at then v.updatedAt = row.updated_at end
  if truthy(row.hidden) then v.hidden = true end
  local rx = exec([[
    SELECT emoji, count(*)::int AS n, bool_or(author = $2) AS mine
    FROM ab_reactions WHERE post_key = $1 GROUP BY emoji ORDER BY min(created_at)]], P(row.key, viewer or ""))
  if #rx > 0 then
    v.reactions = {}
    for _, r in ipairs(rx) do
      table.insert(v.reactions, { emoji = r.emoji, count = tonumber(r.n), viewer = truthy(r.mine) })
    end
  end
  return v
end

-- The opening post of a thread with text, shown as post number 1.
local function opening_post_view(row, viewer)
  local v = post_view(row, viewer)
  v.number = 1
  v.thread = row.key
  return v
end

local function channel_view(row, viewer)
  local v = {
    key = row.key, uri = row.uri, slug = row.slug, title = row.title or "untitled",
    position = tonumber(row.position) or 0,
    threadCount = tonumber(row.thread_count) or 0, postCount = tonumber(row.post_count) or 0,
    lastActivityAt = row.last_activity_at or row.created_at,
    private = truthy(row.private),
  }
  if row.description then v.description = row.description end
  if row.icon then v.icon = row.icon end
  if row.section then v.section = row.section end
  if row.unread then v.unreadCount = tonumber(row.unread) end
  return v
end

local CHANNEL_SQL = [[
  SELECT i.key, i.uri, i.slug, i.title, i.created_at, i.post_count, i.last_activity_at,
         c.section, c.position, c.icon, c.description, c.private,
         (SELECT count(*) FROM ab_items t WHERE t.kind = 'thread' AND t.parent_key = i.key AND NOT t.deleted AND NOT t.hidden) AS thread_count
  FROM ab_channels c JOIN ab_items i ON i.key = c.thread_key
  WHERE NOT i.deleted
]]

local function viewer_state(did)
  local groups, m = groups_of(did)
  local v = { member = m ~= nil, roles = toarray(roles_of(m)) }
  if did then v.did = did end
  if m then
    if m.handle then v.handle = m.handle end
    v.trustLevel = tonumber(m.trust_level) or 0
  end
  v.permissions = permissions(did, nil)
  return v
end

-- ---------------------------------------------------------------- writes

local function main_space() return atproto.spaces.get(config("space_main")) end

-- Index a record we just wrote into ab_items. A thread's own text is its
-- opening post, number 1, as in Discourse; a thread without text (a channel's
-- untitled chat) starts its posts at 1. Posts get the next number in their
-- thread, and the thread's counters move.
local function index_thread(uri, author, rec, space_uri)
  local k = key_for(uri)
  local parent_key = rec.parent and key_for(rec.parent) or nil
  exec([[
    INSERT INTO ab_items (key, uri, kind, space, author, parent_key, title, slug, text, content, tags,
                          created_at, last_activity_at, post_count)
    VALUES ($1, $2, 'thread', $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $11, $12)
    ON CONFLICT (key) DO NOTHING]],
    P(k, uri, space_uri, author, parent_key, rec.title, slugify(rec.title), rec.textContent,
      rec.content and json.encode(rec.content) or nil, json.encode(rec.tags or {}), rec.createdAt,
      (rec.textContent and rec.textContent ~= "") and 1 or 0))
  if parent_key then
    exec("UPDATE ab_items SET last_activity_at = $2 WHERE key = $1", P(parent_key, rec.createdAt))
  end
  log_change("thread", k, k, parent_key)
  return k
end

local function index_post(uri, author, rec, space_uri, thread_key, reply_to_number)
  local k = key_for(uri)
  local n = one([[
    UPDATE ab_items SET post_count = post_count + 1, last_activity_at = $2
    WHERE key = $1 RETURNING post_count]], { thread_key, rec.createdAt }).post_count
  exec([[
    INSERT INTO ab_items (key, uri, kind, space, author, thread_key, text, content, number, reply_to, created_at)
    VALUES ($1, $2, 'post', $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
    ON CONFLICT (key) DO NOTHING]],
    P(k, uri, space_uri, author, thread_key, rec.textContent,
      rec.content and json.encode(rec.content) or nil, n, reply_to_number, rec.createdAt))
  local parent = one("SELECT parent_key FROM ab_items WHERE key = $1", { thread_key })
  if parent and parent.parent_key then
    exec("UPDATE ab_items SET last_activity_at = $2 WHERE key = $1", P(parent.parent_key, rec.createdAt))
  end
  exec([[
    INSERT INTO ab_reads (did, thread_key, last_read) VALUES ($1, $2, $3)
    ON CONFLICT (did, thread_key) DO UPDATE SET last_read = GREATEST(ab_reads.last_read, $3)]],
    P(author, thread_key, n))
  log_change("post", k, thread_key, parent and parent.parent_key or nil)
  return k, tonumber(n)
end

local function require_group_caller()
  local f = forum_did()
  if not f then return fail("NotInitialized", "run admin.initForum first") end
  if caller_did ~= f then return fail("Forbidden", "only the group account may call this") end
  return nil
end

local PUBLIC = { ["$type"] = "com.atproto.simplespace.defs#publicPolicy" }
local MEMBER_LIST = { ["$type"] = "com.atproto.simplespace.defs#memberListPolicy" }

-- Admit or update a member, acting as the group account (the space creator):
-- the group.opensocial.membership record, the read/write flags on each space,
-- and the appview's member row.
local function put_membership(did, roles, profile)
  local members = atproto.spaces.get(config("space_members"))
  members:put_record{ collection = OS .. ".membership", rkey = did, record = {
    ["$type"] = OS .. ".membership", member = did, roles = roles, createdAt = now() } }
  for _, k in ipairs({ "space_meta", "space_members", "space_main" }) do
    local sp = atproto.spaces.get(config(k))
    sp:put_member{ did = did, read = true, write = k ~= "space_meta" }
  end
  profile = profile or {}
  exec([[
    INSERT INTO ab_members (did, roles, trust_level, handle, display_name, avatar, joined_at)
    VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7)
    ON CONFLICT (did) DO UPDATE SET roles = $2::jsonb,
      handle = COALESCE($4, ab_members.handle), display_name = COALESCE($5, ab_members.display_name),
      avatar = COALESCE($6, ab_members.avatar), left_at = NULL]],
    P(did, json.encode(roles), profile.trustLevel or 1, profile.handle, profile.displayName, profile.avatar, now()))
end

-- ---------------------------------------------------------------- end of prelude
