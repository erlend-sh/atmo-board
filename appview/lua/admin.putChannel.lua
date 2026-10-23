-- xrpc.procedure: dev.atmoboard.admin.putChannel
-- Promote a thread to a channel, or start a new channel thread. A channel is
-- a top-level thread plus this sidebar entry; the group writes both.
function handle()
  local denied = require_group_caller()
  if denied then return denied end
  if not input.actor or not permissions(input.actor, nil).admin then
    return fail("Forbidden", "only admins manage channels")
  end
  local main = main_space()
  local thread_key, thread_uri
  if input.thread then
    local item = get_item(input.thread)
    if not item or item.kind ~= "thread" then return fail("NotFound", "no such thread") end
    thread_key, thread_uri = item.key, item.uri
  else
    local rec = { ["$type"] = NS .. ".thread", title = input.title, createdAt = now() }
    local res = main:write_record{ collection = NS .. ".thread", record = rec }
    thread_uri = res.uri
    thread_key = index_thread(res.uri, caller_did, rec, main.uri)
  end
  local position = input.position
  if position == nil then
    position = tonumber(one("SELECT COALESCE(max(position) + 1, 0) AS p FROM ab_channels").p)
  end
  local entry = { ["$type"] = NS .. ".channel", thread = thread_uri, position = position,
    section = input.section, icon = input.icon, description = input.description, createdAt = now() }
  local existing = one("SELECT uri FROM ab_channels WHERE thread_key = $1", { thread_key })
  local rkey = existing and string.match(existing.uri, "([^/]+)$") or TID()
  local res = main:put_record{ collection = NS .. ".channel", rkey = rkey, record = entry }
  exec([[
    INSERT INTO ab_channels (thread_key, uri, section, position, icon, description)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (thread_key) DO UPDATE SET section = $3, position = $4, icon = $5, description = $6]],
    P(thread_key, res.uri, input.section, position, input.icon, input.description))
  if input.title then
    exec("UPDATE ab_items SET title = $2, slug = $3 WHERE key = $1", P(thread_key, input.title, slugify(input.title)))
  end
  log_change("channel", thread_key, thread_key, nil)
  local item = get_item(thread_key)
  return { key = thread_key, uri = thread_uri, slug = item.slug }
end
