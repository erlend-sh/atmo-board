-- xrpc.query: dev.atmoboard.listPosts
-- One filterable query over chat and threads (Zulip's narrows): q, thread
-- and author combine. A thread's opening post counts as its post 1.
function handle()
  local limit = math.min(tonumber(params.limit) or 25, 100)
  local offset = tonumber(params.cursor) or 0
  local visible = {}
  for _, ch in ipairs(exec("SELECT thread_key FROM ab_channels")) do
    if permissions(caller_did, ch.thread_key).see then table.insert(visible, ch.thread_key) end
  end
  if #visible == 0 then return { hits = toarray({}) } end
  local where, args = {
    "NOT i.deleted", "NOT i.hidden",
    "(i.kind = 'post' OR (i.kind = 'thread' AND coalesce(i.text, '') <> ''))",
  }, { table.concat(visible, ",") }
  local q = params.q and params.q:match("^%s*(.-)%s*$") or ""
  if q ~= "" then
    table.insert(args, q)
    local n = "$" .. #args
    table.insert(where, "(to_tsvector('simple', coalesce(i.title, '') || ' ' || coalesce(i.text, '')) @@ plainto_tsquery('simple', " ..
      n .. ") OR i.text ILIKE '%' || " .. n .. " || '%' OR i.title ILIKE '%' || " .. n .. " || '%')")
  end
  if params.thread then
    table.insert(args, params.thread)
    table.insert(where, "(i.thread_key = $" .. #args .. " OR i.key = $" .. #args .. ")")
  end
  if params.author then
    table.insert(args, params.author)
    table.insert(where, "i.author = $" .. #args)
  end
  table.insert(args, limit + 1)
  table.insert(args, offset)
  local rows = exec([[
    WITH hits AS (
      SELECT i.key, i.created_at,
             CASE WHEN i.kind = 'post' THEN coalesce(t.parent_key, t.key) ELSE coalesce(i.parent_key, i.key) END AS ch
      FROM ab_items i LEFT JOIN ab_items t ON i.kind = 'post' AND t.key = i.thread_key
      WHERE ]] .. table.concat(where, " AND ") .. [[
    )
    SELECT key FROM hits WHERE ch = ANY(string_to_array($1, ','))
    ORDER BY created_at DESC LIMIT $]] .. (#args - 1) .. " OFFSET $" .. #args, args)
  local hits = {}
  for i, r in ipairs(rows) do
    if i > limit then break end
    local item = get_item(r.key)
    if item then
      if item.kind == "thread" then
        table.insert(hits, { post = opening_post_view(item, caller_did), thread = thread_view(item, caller_did) })
      else
        local t = get_item(item.thread_key)
        if t then table.insert(hits, { post = post_view(item, caller_did), thread = thread_view(t, caller_did) }) end
      end
    end
  end
  local out = { hits = toarray(hits) }
  if #rows > limit then out.cursor = tostring(offset + limit) end
  return out
end
