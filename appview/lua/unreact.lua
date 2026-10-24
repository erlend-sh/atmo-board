-- xrpc.procedure: dev.atmoboard.unreact
function handle()
  if not caller_did then return fail("Forbidden", "sign in first") end
  local row = one("SELECT r.uri, i.space FROM ab_reactions r JOIN ab_items i ON i.key = r.post_key " ..
    "WHERE r.post_key = $1 AND r.author = $2 AND r.emoji = $3", { input.post, caller_did, input.emoji })
  if not row then return fail("NotFound", "no such reaction") end
  local collection, rkey = record_path(row.uri)
  atproto.spaces.get(row.space):delete_record{ collection = collection, rkey = rkey }
  exec("DELETE FROM ab_reactions WHERE uri = $1", { row.uri })
  local item = one("SELECT key, kind, thread_key FROM ab_items WHERE key = $1", { input.post })
  local tk, pk = thread_and_parent(item)
  log_change("reaction", input.post, tk, pk)
  return { post = input.post, emoji = input.emoji }
end
