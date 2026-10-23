-- xrpc.query: dev.atmoboard.getChanges
-- Slow realtime: hints about what changed since a cursor. Clients refetch
-- the views those keys belong to.
function handle()
  local since = tonumber(params.since) or 0
  local limit = math.min(tonumber(params.limit) or 100, 200)
  local where, args = { "seq > $1" }, { since }
  if params.thread then
    table.insert(args, params.thread)
    table.insert(where, "thread_key = $" .. #args)
  elseif params.parent then
    table.insert(args, params.parent)
    table.insert(where, "(parent_key = $" .. #args .. " OR thread_key = $" .. #args .. ")")
  end
  table.insert(args, limit)
  local rows = exec("SELECT seq, kind, key, thread_key, parent_key FROM ab_changes WHERE " ..
    table.concat(where, " AND ") .. " ORDER BY seq LIMIT $" .. #args, args)
  local changes, cursor = {}, since
  for _, r in ipairs(rows) do
    local c = { seq = tonumber(r.seq), kind = r.kind, key = r.key }
    if r.thread_key then c.thread = r.thread_key end
    if r.parent_key then c.parent = r.parent_key end
    table.insert(changes, c)
    cursor = tonumber(r.seq)
  end
  if #rows == 0 then cursor = math.max(since, tonumber(change_cursor())) end
  return { changes = toarray(changes), cursor = tostring(cursor) }
end
