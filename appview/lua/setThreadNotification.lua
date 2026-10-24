-- xrpc.procedure: dev.atmoboard.setThreadNotification
function handle()
  if not caller_did then return fail("Forbidden", "sign in first") end
  local item = get_item(input.thread)
  if not item or item.kind ~= "thread" then return fail("NotFound", "no such thread") end
  if not permissions(caller_did, channel_of(item)).see then return fail("NotFound", "no such thread") end
  local level = input.level
  if level == "normal" then
    exec("DELETE FROM ab_follows WHERE did = $1 AND thread_key = $2", { caller_did, item.key })
  elseif level == "watching" or level == "muted" then
    exec([[INSERT INTO ab_follows (did, thread_key, level) VALUES ($1, $2, $3)
           ON CONFLICT (did, thread_key) DO UPDATE SET level = $3]], { caller_did, item.key, level })
  else
    return fail("InvalidRequest", "level must be watching, normal or muted")
  end
  return { thread = item.key, level = level }
end
