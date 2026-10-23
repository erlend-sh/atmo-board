-- xrpc.procedure: dev.atmoboard.markRead
-- Read positions only move forward.
function handle()
  if not caller_did then return fail("Forbidden", "sign in first") end
  local thread = get_item(input.thread)
  if not thread or thread.kind ~= "thread" then return fail("NotFound", "no such thread") end
  local n = math.min(math.floor(tonumber(input.number) or 0), tonumber(thread.post_count) or 0)
  local row = one([[
    INSERT INTO ab_reads (did, thread_key, last_read) VALUES ($1, $2, $3)
    ON CONFLICT (did, thread_key) DO UPDATE SET last_read = GREATEST(ab_reads.last_read, $3)
    RETURNING last_read]], P(caller_did, thread.key, n))
  return { thread = thread.key, lastRead = tonumber(row.last_read) }
end
