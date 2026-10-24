-- xrpc.procedure: dev.atmoboard.editPost
-- Authors edit their own records. The version being replaced is kept in
-- ab_revisions so getPostHistory can show it (history starts when this
-- appview first saw the post).
function handle()
  if not caller_did then return fail("Forbidden", "sign in to edit") end
  local item = get_item(input.key)
  if not item or truthy(item.deleted) then return fail("NotFound", "no such post") end
  if item.author ~= caller_did then return fail("Forbidden", "you can only edit your own posts") end
  local text = input.textContent or ""
  if text == "" and item.kind == "post" then return fail("InvalidRequest", "a post needs text") end

  local edits = tonumber(item.edit_count) or 0
  -- Saving without a change isn't an edit.
  if text == (item.text or "") and (item.kind ~= "thread" or (input.title or item.title) == item.title) then
    return { key = item.key, version = edits + 1 }
  end
  exec([[INSERT INTO ab_revisions (key, version, title, text, content, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6) ON CONFLICT DO NOTHING]],
    P(item.key, edits + 1, item.title, item.text, item.content, item.updated_at or item.created_at))

  local at = now()
  local collection, rkey = record_path(item.uri)
  local rec
  if item.kind == "thread" then
    local parent = item.parent_key and one("SELECT uri FROM ab_items WHERE key = $1", { item.parent_key })
    local title = input.title or item.title
    rec = { ["$type"] = NS .. ".thread", title = title, parent = parent and parent.uri or nil,
      textContent = text, content = input.content, tags = decode(item.tags) or {},
      createdAt = item.created_at, updatedAt = at }
    exec([[UPDATE ab_items SET title = $2, slug = $3, text = $4, content = $5::jsonb, updated_at = $6,
           edit_count = edit_count + 1 WHERE key = $1]],
      P(item.key, title, slugify(title), text, input.content and json.encode(input.content) or nil, at))
  else
    local thread = one("SELECT uri FROM ab_items WHERE key = $1", { item.thread_key })
    local reply_uri
    if item.reply_to then
      local n = tonumber(item.reply_to)
      local r = n == 1 and thread or one(
        "SELECT uri FROM ab_items WHERE kind = 'post' AND thread_key = $1 AND number = $2", { item.thread_key, n })
      reply_uri = r and r.uri or nil
    end
    rec = { ["$type"] = NS .. ".post", thread = thread.uri, replyTo = reply_uri, textContent = text,
      content = input.content, createdAt = item.created_at, updatedAt = at }
    exec([[UPDATE ab_items SET text = $2, content = $3::jsonb, updated_at = $4, edit_count = edit_count + 1
           WHERE key = $1]], P(item.key, text, input.content and json.encode(input.content) or nil, at))
  end
  atproto.spaces.get(item.space):put_record{ collection = collection, rkey = rkey, record = rec }
  local tk, pk = thread_and_parent(item)
  log_change("edit", item.key, tk, pk)
  return { key = item.key, version = edits + 2 }
end
