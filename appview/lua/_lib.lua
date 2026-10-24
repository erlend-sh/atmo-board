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

-- Booleans go to SQL as text with a ::boolean cast (db.raw binds Lua booleans as 1/0).
local function B(v) return v and "true" or "false" end

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
  local tl = m and tonumber(m.trust_level) or -1
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
  -- Discourse's ladder: TL1 can flag, TL3 can rename and move threads
  -- (recategorise), TL4 can also pin, lock and hide. Staff can do it all,
  -- plus whispers, the review queue and trust levels.
  return {
    see = best >= LEVEL.see,
    reply = m ~= nil and best >= LEVEL.reply,
    create = m ~= nil and best >= LEVEL.create,
    flag = m ~= nil and best >= LEVEL.see and (tl >= 1 or staff),
    curate = staff or tl >= 3,
    manage = staff or tl >= 4,
    moderate = staff,
    admin = has_role(roles, "admin"),
  }
end

local function viewer_is_staff(did)
  return did ~= nil and is_staff(roles_of(member_row(did)))
end

-- New members (TL0) are sandboxed the Discourse way: a couple of links per
-- post at most. Returns an error, or nil when the text is fine.
local function sandbox_check(member, text)
  if not member or (tonumber(member.trust_level) or 0) >= 1 or is_staff(roles_of(member)) then return nil end
  local links = 0
  for _ in string.gmatch(text or "", "https?://") do links = links + 1 end
  if links > 2 then return fail("Sandboxed", "new members can include up to 2 links in a post") end
  return nil
end

-- ---------------------------------------------------------------- items

local ITEM_COLS = [[
  i.key, i.uri, i.kind, i.space, i.author, i.thread_key, i.parent_key, i.title, i.slug,
  i.text, i.content::text AS content, i.tags::text AS tags, i.number, i.reply_to,
  i.created_at, i.updated_at, i.last_activity_at, i.post_count,
  i.locked, i.pinned, i.hidden, i.deleted, i.edit_count, i.whisper, i.last_public, i.hidden_by,
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

-- How many posts the viewer can count in a thread: whispers are numbered
-- like any post, but only staff see them.
local function visible_count(row, staff)
  return tonumber(staff and row.post_count or row.last_public) or 0
end

local function thread_view(row, viewer, staff)
  if staff == nil then staff = viewer_is_staff(viewer) end
  local v = {
    key = row.key, uri = row.uri, slug = row.slug, author = author_view(row),
    postCount = visible_count(row, staff),
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
    local f = one("SELECT level FROM ab_follows WHERE did = $1 AND thread_key = $2", { viewer, row.key })
    v.notificationLevel = f and f.level or "normal"
  end
  return v
end

-- see_hidden: the viewer may read hidden posts (staff and TL4). Anyone else
-- gets the number and a hidden marker, like a deleted post.
local function post_view(row, viewer, see_hidden)
  local v = {
    key = row.key, uri = row.uri, number = tonumber(row.number), thread = row.thread_key,
    author = author_view(row), textContent = row.text or "", createdAt = row.created_at,
  }
  local md = markdown_of(row)
  if md then v.content = md end
  if row.reply_to then v.replyTo = tonumber(row.reply_to) end
  if row.updated_at then v.updatedAt = row.updated_at end
  if truthy(row.hidden) then
    v.hidden = true
    if row.hidden_by then v.hiddenBy = row.hidden_by end
  end
  if truthy(row.whisper) then v.whisper = true end
  local edits = tonumber(row.edit_count) or 0
  if edits > 0 then v.editCount = edits end
  if truthy(row.deleted) then
    -- The author deleted it: keep the number, drop everything else.
    v.deleted, v.textContent, v.content, v.editCount = true, "", nil, nil
    return v
  end
  if v.hidden and not see_hidden then
    v.textContent, v.content, v.editCount = "", nil, nil
    return v
  end
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
local function opening_post_view(row, viewer, see_hidden)
  local v = post_view(row, viewer, see_hidden)
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
  if row.unread_chat ~= nil then v.unreadChat = truthy(row.unread_chat) end
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

-- at://{group}/space/{type}/{skey}/{author}/{collection}/{rkey}
local function record_path(uri)
  local parts = {}
  for seg in string.gmatch(uri, "[^/]+") do table.insert(parts, seg) end
  return parts[#parts - 1], parts[#parts]
end

-- The thread (and its channel) an item belongs to, for change hints.
local function thread_and_parent(item)
  local tk = item.kind == "post" and item.thread_key or item.key
  local t = one("SELECT parent_key FROM ab_items WHERE key = $1", { tk })
  return tk, t and t.parent_key or nil
end

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

local function index_post(uri, author, rec, space_uri, thread_key, reply_to_number, whisper)
  local k = key_for(uri)
  -- A whisper takes a number but doesn't move what non-staff can see.
  local n = one([[
    UPDATE ab_items SET post_count = post_count + 1,
      last_public = CASE WHEN $3::boolean THEN last_public ELSE post_count + 1 END,
      last_activity_at = CASE WHEN $3::boolean THEN last_activity_at ELSE $2 END
    WHERE key = $1 RETURNING post_count]], { thread_key, rec.createdAt, B(whisper) }).post_count
  exec([[
    INSERT INTO ab_items (key, uri, kind, space, author, thread_key, text, content, number, reply_to, created_at, whisper)
    VALUES ($1, $2, 'post', $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::boolean)
    ON CONFLICT (key) DO NOTHING]],
    P(k, uri, space_uri, author, thread_key, rec.textContent,
      rec.content and json.encode(rec.content) or nil, n, reply_to_number, rec.createdAt, B(whisper)))
  local parent = one("SELECT parent_key FROM ab_items WHERE key = $1", { thread_key })
  if parent and parent.parent_key and not whisper then
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

-- ---------------------------------------------------------------- roles and spaces
-- The group-host stand-in. Calls that write membership or space flags must
-- come from the group account (the creator of every space).

-- A member's roles as published: their granted roles plus "tl0".."tl4" for
-- their trust level, since in the group model trust levels are roles.
local function published_roles(roles, level)
  local out = {}
  for _, r in ipairs(roles) do
    if not string.match(r, "^tl%d$") then table.insert(out, r) end
  end
  table.insert(out, "tl" .. (tonumber(level) or 0))
  return out
end

local function space_or_nil(uri)
  if not uri then return nil end
  return atproto.spaces.get(uri)
end

-- Bring one member's flags on the restricted spaces in line with their
-- roles: the staff space for whispers, and each private channel's space.
local function sync_spaces(did)
  local m = member_row(did)
  local staff = m ~= nil and is_staff(roles_of(m))
  local sp = space_or_nil(config("space_staff"))
  if sp then
    if staff then sp:put_member{ did = did, read = true, write = true }
    else pcall(function() sp:remove_member{ did = did } end) end
  end
  for _, ch in ipairs(exec([[SELECT c.thread_key, i.space FROM ab_channels c JOIN ab_items i ON i.key = c.thread_key
                             WHERE c.private AND NOT i.deleted]])) do
    local csp = space_or_nil(ch.space)
    local perms = m and permissions(did, ch.thread_key) or { see = false }
    if csp then
      if perms.see then csp:put_member{ did = did, read = true, write = perms.reply == true }
      else pcall(function() csp:remove_member{ did = did } end) end
    end
  end
end

-- Write the member's group.opensocial.membership from ab_members, then sync.
local function publish_membership(did)
  local m = one("SELECT roles::text AS roles, trust_level FROM ab_members WHERE did = $1 AND left_at IS NULL", { did })
  if not m then return end
  local members = atproto.spaces.get(config("space_members"))
  members:put_record{ collection = OS .. ".membership", rkey = did, record = {
    ["$type"] = OS .. ".membership", member = did,
    roles = published_roles(decode(m.roles) or {}, m.trust_level), createdAt = now() } }
  sync_spaces(did)
end

-- Admit or update a member, acting as the group account: the appview's
-- member row, read/write flags on the shared spaces, and the published
-- membership. New members start at trust level 0 unless told otherwise.
local function put_membership(did, roles, profile)
  for _, k in ipairs({ "space_meta", "space_members", "space_main" }) do
    local sp = atproto.spaces.get(config(k))
    sp:put_member{ did = did, read = true, write = k ~= "space_meta" }
  end
  profile = profile or {}
  exec([[
    INSERT INTO ab_members (did, roles, trust_level, handle, display_name, avatar, joined_at)
    VALUES ($1, $2::jsonb, COALESCE($3, 0), $4, $5, $6, $7)
    ON CONFLICT (did) DO UPDATE SET roles = $2::jsonb, trust_level = COALESCE($3, ab_members.trust_level),
      handle = COALESCE($4, ab_members.handle), display_name = COALESCE($5, ab_members.display_name),
      avatar = COALESCE($6, ab_members.avatar), left_at = NULL]],
    P(did, json.encode(roles), profile.trustLevel, profile.handle, profile.displayName, profile.avatar, now()))
  publish_membership(did)
end

-- ---------------------------------------------------------------- trust levels
-- Discourse's defaults for the automatic levels. TL4 is only ever granted by
-- staff, and a staff-set level is locked until staff unlock it.
local TRUST = {
  { topics = 5, read = 30 },                                                        -- TL1
  { days = 15, replied = 3, topics = 20, read = 100, given = 1, received = 1 },     -- TL2
  { days = 50, replied = 10, topics_share = 0.25, read_share = 0.25,                 -- TL3, over 100 days
    given = 30, received = 20, max_flagged = 5 },
}

local function trust_stats(did, window)
  local since = window and "current_date - " .. window or "'-infinity'::date"
  local at = window and "now() - interval '" .. window .. " days'" or "'-infinity'::timestamptz"
  return one([[
    SELECT
      (SELECT count(*) FROM ab_activity WHERE did = $1 AND day >= ]] .. since .. [[) AS days,
      (SELECT COALESCE(sum(posts_read), 0) FROM ab_activity WHERE did = $1 AND day >= ]] .. since .. [[) AS read,
      (SELECT COALESCE(sum(topics_entered), 0) FROM ab_activity WHERE did = $1 AND day >= ]] .. since .. [[) AS topics,
      (SELECT count(DISTINCT p.thread_key) FROM ab_items p LEFT JOIN ab_channels c ON c.thread_key = p.thread_key
        WHERE p.kind = 'post' AND p.author = $1 AND c.thread_key IS NULL AND NOT p.deleted
          AND p.created_at::timestamptz >= ]] .. at .. [[) AS replied,
      (SELECT count(*) FROM ab_reactions WHERE author = $1 AND created_at::timestamptz >= ]] .. at .. [[) AS given,
      (SELECT count(*) FROM ab_reactions r JOIN ab_items i ON i.key = r.post_key
        WHERE i.author = $1 AND r.author <> $1 AND r.created_at::timestamptz >= ]] .. at .. [[) AS received,
      (SELECT count(*) FROM ab_reports r JOIN ab_items i ON i.key = r.subject_key
        WHERE i.author = $1 AND r.status = 'agreed' AND r.created_at::timestamptz >= ]] .. at .. [[) AS flagged,
      (SELECT count(*) FROM ab_items WHERE kind = 'thread' AND NOT deleted AND created_at::timestamptz >= ]] .. at .. [[) AS all_topics,
      (SELECT count(*) FROM ab_items WHERE kind = 'post' AND NOT deleted AND NOT whisper AND created_at::timestamptz >= ]] .. at .. [[) AS all_posts
  ]], { did })
end

local function meets(stats, bar)
  local n = function(k) return tonumber(stats[k]) or 0 end
  if bar.days and n("days") < bar.days then return false end
  if bar.replied and n("replied") < bar.replied then return false end
  if bar.topics and n("topics") < bar.topics then return false end
  if bar.read and n("read") < bar.read then return false end
  if bar.given and n("given") < bar.given then return false end
  if bar.received and n("received") < bar.received then return false end
  if bar.topics_share and n("topics") < math.min(math.ceil(n("all_topics") * bar.topics_share), 500) then return false end
  if bar.read_share and n("read") < math.min(math.ceil(n("all_posts") * bar.read_share), 20000) then return false end
  if bar.max_flagged and n("flagged") > bar.max_flagged then return false end
  return true
end

-- The automatic level for a member now: only ever promotes, except that TL3
-- is re-earned continually and falls back to TL2, as in Discourse.
local function computed_level(did, current)
  local all = trust_stats(did, nil)
  local level = 0
  if meets(all, TRUST[1]) then level = 1 end
  if level == 1 and meets(all, TRUST[2]) then level = 2 end
  if level == 2 and meets(trust_stats(did, 100), TRUST[3]) then level = 3 end
  if current == 3 and level < 3 then return 2 end
  return math.max(level, math.min(current, 2))
end

-- Recompute and store; returns the new level if it changed. Publishing it
-- (as a role on the membership record) needs the group account: callers
-- that aren't it return the new level so the web app can call
-- admin.syncMember.
local function refresh_trust(did)
  local m = one("SELECT trust_level, trust_locked FROM ab_members WHERE did = $1 AND left_at IS NULL", { did })
  if not m or truthy(m.trust_locked) then return nil end
  local current = tonumber(m.trust_level) or 0
  if current >= 4 then return nil end
  local level = computed_level(did, current)
  if level == current then return nil end
  exec("UPDATE ab_members SET trust_level = $2 WHERE did = $1", { did, level })
  log_change("member", did, nil, nil)
  return level
end

-- ---------------------------------------------------------------- overrides
-- A curation or moderation decision, written by the group into the main
-- space and applied to the derived tables. Returns the override's uri.
local function apply_override(actor, subject, action, detail, reason)
  detail = detail or {}
  local rec = { ["$type"] = NS .. ".override", action = action, actor = actor, reason = reason, createdAt = now() }
  local item = string.sub(subject, 1, 4) ~= "did:" and get_item(subject) or nil
  rec.subject = item and item.uri or subject
  if action == "move" then rec.toThread = detail.toUri end
  if action == "rename" then rec.title = detail.title end
  if action == "setTrustLevel" then rec.level, rec.locked = detail.level, detail.locked end
  local res = main_space():write_record{ collection = NS .. ".override", record = rec }
  exec([[INSERT INTO ab_overrides (uri, subject, action, actor, reason, detail, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)]],
    P(res.uri, item and item.key or subject, action, actor, reason, json.encode(detail), rec.createdAt))

  if action == "ban" then
    log_change("member", subject, nil, nil)
    return res.uri
  end

  if action == "setTrustLevel" then
    exec("UPDATE ab_members SET trust_level = $2, trust_locked = $3::boolean WHERE did = $1",
      P(subject, detail.level, B(detail.locked)))
    if detail.locked ~= true then refresh_trust(subject) end
    publish_membership(subject)
    log_change("member", subject, nil, nil)
    return res.uri
  end

  local tk, pk = thread_and_parent(item)
  if action == "hide" or action == "unhide" then
    exec("UPDATE ab_items SET hidden = $2::boolean, hidden_by = $3 WHERE key = $1",
      P(item.key, B(action == "hide"), action == "hide" and (detail.by or "staff") or nil))
  elseif action == "lock" or action == "unlock" then
    exec("UPDATE ab_items SET locked = $2::boolean WHERE key = $1", P(item.key, B(action == "lock")))
  elseif action == "pin" or action == "unpin" then
    exec("UPDATE ab_items SET pinned = $2::boolean WHERE key = $1", P(item.key, B(action == "pin")))
  elseif action == "rename" then
    exec("UPDATE ab_items SET title = $2, slug = $3 WHERE key = $1", P(item.key, detail.title, slugify(detail.title)))
  elseif action == "move" then
    exec("UPDATE ab_items SET parent_key = $2 WHERE key = $1", P(item.key, detail.to))
    log_change("override", item.key, tk, detail.to)
  end
  log_change("override", item.key, tk, pk)
  return res.uri
end

-- ---------------------------------------------------------------- end of prelude
