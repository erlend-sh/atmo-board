-- xrpc.procedure: dev.atmoboard.createPost
-- Posting straight into a channel thread is the channel's untitled chat.
function handle()
  if not caller_did then return fail("Forbidden", "sign in to post") end
  if not member_row(caller_did) then return fail("Forbidden", "join the forum to post") end
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
      if not target or target.kind ~= "post" or target.thread_key ~= thread.key then
        return fail("NotFound", "the post you're answering isn't in this thread")
      end
      reply_uri, reply_number = target.uri, tonumber(target.number)
    end
  end
  local rec = { ["$type"] = NS .. ".post", thread = thread.uri, replyTo = reply_uri,
    textContent = input.textContent, content = input.content, createdAt = now() }
  local sp = atproto.spaces.get(thread.space)
  local res = sp:write_record{ collection = NS .. ".post", record = rec }
  local k, n = index_post(res.uri, caller_did, rec, thread.space, thread.key, reply_number)
  return { key = k, uri = res.uri, number = n }
end
