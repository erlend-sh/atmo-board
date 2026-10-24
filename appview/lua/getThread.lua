-- xrpc.query: dev.atmoboard.getThread
-- A thread and a window of posts around an anchor, Discourse style: the
-- thread's own text is post 1, and posts are addressed by number.
function handle()
  local thread = get_item(params.key)
  if not thread or thread.kind ~= "thread" then return fail("NotFound", "no such thread") end
  local channel_key = channel_of(thread)
  local perms = permissions(caller_did, channel_key)
  if not perms.see or (truthy(thread.hidden) and not perms.moderate) then
    return fail("NotFound", "no such thread")
  end
  local total = tonumber(thread.post_count) or 0
  local has_opening = thread.text ~= nil and thread.text ~= ""
  local anchor = params.anchor or "first"
  local n
  if anchor == "last" then
    n = total
  elseif anchor == "first_unread" then
    local r = caller_did and one("SELECT last_read FROM ab_reads WHERE did = $1 AND thread_key = $2", { caller_did, thread.key })
    n = math.min((r and tonumber(r.last_read) or 0) + 1, math.max(total, 1))
  else
    n = tonumber(anchor) or 1
  end
  local before = tonumber(params.before) or (anchor == "first" and 0 or 20)
  local after = tonumber(params.after) or 50
  local lo, hi = math.max(1, n - before), math.min(total, n + after)

  local posts = {}
  if has_opening and lo <= 1 then table.insert(posts, opening_post_view(thread, caller_did)) end
  local rows = exec("SELECT " .. ITEM_COLS .. ITEM_FROM ..
    " WHERE i.kind = 'post' AND i.thread_key = $1 AND i.number BETWEEN $2 AND $3 ORDER BY i.number",
    P(thread.key, lo, hi))
  for _, row in ipairs(rows) do
    if not truthy(row.hidden) or perms.moderate then table.insert(posts, post_view(row, caller_did)) end
  end

  local ancestors = {}
  local k = thread.parent_key
  while k do
    local a = get_item(k)
    if not a then break end
    table.insert(ancestors, 1, thread_view(a, nil))
    k = a.parent_key
  end
  local ch = one(CHANNEL_SQL .. " AND i.key = $1", { channel_key })
  local out = {
    thread = thread_view(thread, caller_did), ancestors = toarray(ancestors), posts = toarray(posts),
    hasBefore = lo > 1, hasAfter = hi < total, permissions = perms, changeCursor = change_cursor(),
  }
  if ch then out.channel = channel_view(ch, caller_did) end
  if truthy(thread.locked) and not perms.moderate then
    out.permissions.reply = false
    out.permissions.create = false
  end
  return out
end
