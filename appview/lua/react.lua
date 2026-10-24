-- xrpc.procedure: dev.atmoboard.react
-- A reaction is the reactor's own record in the subject's space.
function handle()
  if not caller_did then return fail("Forbidden", "sign in to react") end
  if not member_row(caller_did) then return fail("Forbidden", "join the forum to react") end
  local item = get_item(input.post)
  if not item then return fail("NotFound", "no such post") end
  if not permissions(caller_did, channel_of(item)).reply then return fail("Forbidden", "you can't react here") end
  local emoji = input.emoji
  if not emoji or emoji == "" then return fail("InvalidRequest", "emoji is required") end
  local existing = one("SELECT uri FROM ab_reactions WHERE post_key = $1 AND author = $2 AND emoji = $3",
    { item.key, caller_did, emoji })
  if existing then return { post = item.key, emoji = emoji, uri = existing.uri } end
  local rec = { ["$type"] = NS .. ".reaction", subject = item.uri, emoji = emoji, createdAt = now() }
  local res = atproto.spaces.get(item.space):write_record{ collection = NS .. ".reaction", record = rec }
  exec([[INSERT INTO ab_reactions (uri, post_key, author, emoji, created_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING]], P(res.uri, item.key, caller_did, emoji, rec.createdAt))
  local tk, pk = thread_and_parent(item)
  log_change("reaction", item.key, tk, pk)
  return { post = item.key, emoji = emoji, uri = res.uri }
end
