-- xrpc.procedure: dev.atmoboard.createPost
-- Posting straight into a channel thread is the channel's untitled chat.
function handle()
  if not caller_did then return fail("Forbidden", "sign in to post") end
  local m = member_row(caller_did)
  if not m then return fail("Forbidden", "join the forum to post") end
  local sandboxed = sandbox_check(m, input.textContent)
  if sandboxed then return sandboxed end
  local thread = get_item(input.thread)
  if not thread or thread.kind ~= "thread" then return fail("NotFound", "no such thread") end
  local perms = permissions(caller_did, channel_of(thread))
  if not perms.reply then return fail("Forbidden", "you can't post here") end
  if truthy(thread.locked) and not perms.moderate then return fail("Locked", "this thread is locked") end
  local reply_uri, reply_number
  if input.replyTo then
    if input.replyTo == thread.key then
      reply_uri, reply_number = thread.uri, 1
    else
      local target = get_item(input.replyTo)
      if not target or target.kind ~= "post" or target.thread_key ~= thread.key
        or (truthy(target.whisper) and not perms.moderate) then
        return fail("NotFound", "the post you're answering isn't in this thread")
      end
      reply_uri, reply_number = target.uri, tonumber(target.number)
    end
  end
  local rec = { ["$type"] = NS .. ".post", thread = thread.uri, replyTo = reply_uri,
    textContent = input.textContent, content = input.content, createdAt = now() }
  -- A whisper is a staff-only post: same thread and numbering, but the
  -- record lives in the staff space, which only staff can read.
  local space_uri = thread.space
  if input.whisper then
    if not perms.moderate then return fail("Forbidden", "only staff can whisper") end
    space_uri = config("space_staff")
    if not space_uri then return fail("NotInitialized", "the staff space is missing; rerun admin.initForum") end
  end
  local sp = atproto.spaces.get(space_uri)
  local res = sp:write_record{ collection = NS .. ".post", record = rec }
  local k, n = index_post(res.uri, caller_did, rec, space_uri, thread.key, reply_number, input.whisper == true)
  return { key = k, uri = res.uri, number = n }
end
