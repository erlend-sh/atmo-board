-- xrpc.query: dev.atmoboard.listThreads
-- Discourse's topic lists. With parent: the named threads in one channel,
-- pinned first. Without: latest across every channel the viewer can see.
-- Up to five people who posted in a thread, in order of first post.
local function participants(key)
  local rows = exec([[
    SELECT a.author, m.handle AS author_handle, m.display_name AS author_name, m.avatar AS author_avatar,
           m.roles::text AS author_roles, m.trust_level AS author_tl
    FROM (SELECT author, min(created_at) AS first FROM ab_items
          WHERE (key = $1 OR (thread_key = $1 AND kind = 'post')) AND NOT deleted AND NOT hidden
          GROUP BY author) a
    LEFT JOIN ab_members m ON m.did = a.author
    ORDER BY a.first LIMIT 5]], P(key))
  local out = {}
  for _, r in ipairs(rows) do table.insert(out, author_view(r)) end
  return toarray(out)
end

function handle()
  local limit = math.min(tonumber(params.limit) or 30, 100)
  local offset = tonumber(params.cursor) or 0
  local order = ({ latest = "i.last_activity_at DESC", new = "i.created_at DESC",
    unread = "i.last_activity_at DESC", top = "i.post_count DESC, i.last_activity_at DESC" })[params.sort or "latest"] or "i.last_activity_at DESC"
  local where, args = { "i.kind = 'thread'", "NOT i.deleted", "NOT i.hidden", "c.thread_key IS NULL" }, {}
  if params.parent then
    local parent = get_item(params.parent)
    if not parent then return fail("NotFound", "no such channel") end
    if not permissions(caller_did, channel_of(parent)).see then return fail("NotFound", "no such channel") end
    table.insert(args, params.parent)
    table.insert(where, "i.parent_key = $" .. #args)
    order = "i.pinned DESC, " .. order
  else
    -- Only threads that sit directly in a visible channel.
    local visible = {}
    for _, ch in ipairs(exec("SELECT thread_key FROM ab_channels")) do
      if permissions(caller_did, ch.thread_key).see then table.insert(visible, ch.thread_key) end
    end
    if #visible == 0 then return { threads = toarray({}), changeCursor = change_cursor() } end
    table.insert(args, table.concat(visible, ","))
    table.insert(where, "i.parent_key = ANY(string_to_array($" .. #args .. ", ','))")
  end
  if params.sort == "unread" then
    -- Threads the viewer hasn't seen, or has unread posts in.
    if not caller_did then return { threads = toarray({}), changeCursor = change_cursor() } end
    table.insert(args, caller_did)
    table.insert(where, "i.post_count > COALESCE((SELECT last_read FROM ab_reads WHERE did = $" .. #args ..
      " AND thread_key = i.key), -1)")
  end
  if params.tag then
    table.insert(args, json.encode({ params.tag }))
    table.insert(where, "i.tags @> $" .. #args .. "::jsonb")
  end
  table.insert(args, limit + 1)
  table.insert(args, offset)
  local rows = exec("SELECT " .. ITEM_COLS .. ITEM_FROM .. " WHERE " .. table.concat(where, " AND ") ..
    " ORDER BY " .. order .. " LIMIT $" .. (#args - 1) .. " OFFSET $" .. #args, args)
  local threads = {}
  for i, row in ipairs(rows) do
    if i <= limit then
      local v = thread_view(row, caller_did)
      v.participants = participants(row.key)
      table.insert(threads, v)
    end
  end
  local out = { threads = toarray(threads), changeCursor = change_cursor() }
  if #rows > limit then out.cursor = tostring(offset + limit) end
  return out
end
