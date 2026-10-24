-- xrpc.procedure: dev.atmoboard.admin.putChannel
-- Promote a thread to a channel, or start a new channel thread. A channel is
-- a top-level thread plus this sidebar entry; the group writes both.
function handle()
  local denied = require_group_caller()
  if denied then return denied end
  if not input.actor or not permissions(input.actor, nil).admin then
    return fail("Forbidden", "only admins manage channels")
  end
  local thread_key, thread_uri
  local private = input.private == true
  if input.thread then
    local item = get_item(input.thread)
    if not item or item.kind ~= "thread" then return fail("NotFound", "no such thread") end
    thread_key, thread_uri = item.key, item.uri
    local was = one("SELECT private FROM ab_channels WHERE thread_key = $1", { thread_key })
    if was and input.private ~= nil and truthy(was.private) ~= private then
      return fail("InvalidRequest", "a channel's privacy can't change: its records live in its space")
    end
    private = was and truthy(was.private) or private
  else
    -- A private channel is a channel whose subtree lives in its own space,
    -- readable by its access list. Public ones share the main space.
    local sp = main_space()
    if private then
      sp = atproto.spaces.create{ type = SPACE_TYPE, skey = TID(), display_name = input.title,
        read_policy = MEMBER_LIST, write_policy = MEMBER_LIST }
      sp:put_record{ collection = OS .. ".access", rkey = "self", record = {
        ["$type"] = OS .. ".access", public = false,
        grants = { { role = "moderator", scopes = { "read", "write" } }, { role = "admin", scopes = { "read", "write" } } } } }
    end
    local rec = { ["$type"] = NS .. ".thread", title = input.title, createdAt = now() }
    local res = sp:write_record{ collection = NS .. ".thread", record = rec }
    thread_uri = res.uri
    thread_key = index_thread(res.uri, caller_did, rec, sp.uri)
  end
  local main = main_space()
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
    INSERT INTO ab_channels (thread_key, uri, section, position, icon, description, private)
    VALUES ($1, $2, $3, $4, $5, $6, $7::boolean)
    ON CONFLICT (thread_key) DO UPDATE SET section = $3, position = $4, icon = $5, description = $6]],
    P(thread_key, res.uri, input.section, position, input.icon, input.description, B(private)))

  -- Who may see, reply or create here. Rows replace any earlier ones; with
  -- none, a public channel uses the default and a private one stays staff-only.
  if input.access then
    exec("DELETE FROM ab_channel_access WHERE channel_key = $1", { thread_key })
    for _, a in ipairs(input.access) do
      if LEVEL[a.level] then
        exec([[INSERT INTO ab_channel_access (channel_key, grp, level) VALUES ($1, $2, $3)
               ON CONFLICT (channel_key, grp) DO UPDATE SET level = $3]], { thread_key, a.group, a.level })
      end
    end
  elseif private and not input.thread then
    for _, r in ipairs({ "moderator", "admin" }) do
      exec("INSERT INTO ab_channel_access (channel_key, grp, level) VALUES ($1, $2, 'create') ON CONFLICT DO NOTHING",
        { thread_key, r })
    end
  end
  if private then
    -- Re-sync every member's flags on the private spaces after a change.
    for _, m in ipairs(exec("SELECT did FROM ab_members WHERE left_at IS NULL")) do sync_spaces(m.did) end
  end
  if input.title then
    exec("UPDATE ab_items SET title = $2, slug = $3 WHERE key = $1", P(thread_key, input.title, slugify(input.title)))
  end
  log_change("channel", thread_key, thread_key, nil)
  local item = get_item(thread_key)
  return { key = thread_key, uri = thread_uri, slug = item.slug }
end
