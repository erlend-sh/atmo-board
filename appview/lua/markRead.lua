-- xrpc.procedure: dev.atmoboard.markRead
-- Read positions only move forward. Reading is also the private input to
-- trust levels: posts read, topics entered and days visited, per day.
function handle()
  if not caller_did then return fail("Forbidden", "sign in first") end
  local thread = get_item(input.thread)
  if not thread or thread.kind ~= "thread" then return fail("NotFound", "no such thread") end
  local n = math.min(math.floor(tonumber(input.number) or 0), tonumber(thread.post_count) or 0)
  local before = one("SELECT last_read FROM ab_reads WHERE did = $1 AND thread_key = $2", { caller_did, thread.key })
  local row = one([[
    INSERT INTO ab_reads (did, thread_key, last_read) VALUES ($1, $2, $3)
    ON CONFLICT (did, thread_key) DO UPDATE SET last_read = GREATEST(ab_reads.last_read, $3)
    RETURNING last_read]], P(caller_did, thread.key, n))
  local out = { thread = thread.key, lastRead = tonumber(row.last_read) }
  if member_row(caller_did) then
    local read = tonumber(row.last_read) - (before and tonumber(before.last_read) or 0)
    exec([[INSERT INTO ab_activity (did, posts_read, topics_entered) VALUES ($1, $2, $3)
           ON CONFLICT (did, day) DO UPDATE SET posts_read = ab_activity.posts_read + $2,
             topics_entered = ab_activity.topics_entered + $3]],
      { caller_did, math.max(read, 0), before and 0 or 1 })
    local level = refresh_trust(caller_did)
    if level then out.trustLevel = level end
  end
  return out
end
