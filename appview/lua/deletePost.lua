-- xrpc.procedure: dev.atmoboard.deletePost
-- Author deletes are honoured fully: the record leaves the space, and the
-- appview drops its text, history and reactions. A reply keeps its number,
-- shown as deleted; deleting a thread's opening post deletes the thread.
function handle()
  if not caller_did then return fail("Forbidden", "sign in first") end
  local item = get_item(input.key)
  if not item or truthy(item.deleted) then return fail("NotFound", "no such post") end
  if item.author ~= caller_did then return fail("Forbidden", "you can only delete your own posts") end
  if truthy(item.is_channel) then return fail("Forbidden", "remove the channel first") end
  local collection, rkey = record_path(item.uri)
  local sp = atproto.spaces.get(item.space)
  sp:delete_record{ collection = collection, rkey = rkey }
  for _, r in ipairs(exec("SELECT uri FROM ab_reactions WHERE post_key = $1 AND author = $2", { item.key, caller_did })) do
    local c, k = record_path(r.uri)
    sp:delete_record{ collection = c, rkey = k }
  end
  exec("DELETE FROM ab_reactions WHERE post_key = $1", { item.key })
  exec("DELETE FROM ab_revisions WHERE key = $1", { item.key })
  exec([[UPDATE ab_items SET deleted = true, text = NULL, content = NULL, title = CASE WHEN kind = 'post' THEN NULL ELSE title END,
         edit_count = 0 WHERE key = $1]], { item.key })
  local tk, pk = thread_and_parent(item)
  log_change("delete", item.key, tk, pk)
  return { key = item.key }
end
