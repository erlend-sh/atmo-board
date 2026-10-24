-- xrpc.procedure: dev.atmoboard.createThread
function handle()
  if not caller_did then return fail("Forbidden", "sign in to post") end
  local m = member_row(caller_did)
  if not m then return fail("Forbidden", "join the forum to post") end
  local sandboxed = sandbox_check(m, input.textContent)
  if sandboxed then return sandboxed end
  if not input.parent then
    if not is_staff(roles_of(m)) then return fail("Forbidden", "only staff start top-level threads") end
  end
  local parent, space_uri
  if input.parent then
    parent = get_item(input.parent)
    if not parent or parent.kind ~= "thread" then return fail("NotFound", "no such channel or thread") end
    local perms = permissions(caller_did, channel_of(parent))
    if not perms.create then return fail("Forbidden", "you can't start threads here") end
    if truthy(parent.locked) and not perms.moderate then return fail("Locked", "this channel is locked") end
    space_uri = parent.space
  else
    space_uri = config("space_main")
  end
  local rec = { ["$type"] = NS .. ".thread", title = input.title, parent = parent and parent.uri or nil,
    textContent = input.textContent, content = input.content, tags = input.tags, createdAt = now() }
  local sp = atproto.spaces.get(space_uri)
  local res = sp:write_record{ collection = NS .. ".thread", record = rec }
  local k = index_thread(res.uri, caller_did, rec, space_uri)
  if rec.textContent and rec.textContent ~= "" then
    exec([[INSERT INTO ab_reads (did, thread_key, last_read) VALUES ($1, $2, 1)
             ON CONFLICT (did, thread_key) DO NOTHING]], P(caller_did, k))
  end
  return { key = k, uri = res.uri, slug = slugify(input.title) }
end
