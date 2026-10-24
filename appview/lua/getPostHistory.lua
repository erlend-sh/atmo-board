-- xrpc.query: dev.atmoboard.getPostHistory
function handle()
  local item = get_item(params.key)
  if not item or truthy(item.deleted) then return fail("NotFound", "no such post") end
  local perms = permissions(caller_did, channel_of(item))
  if not perms.see or (truthy(item.hidden) and not perms.moderate) then return fail("NotFound", "no such post") end
  local out = {}
  local function view(r, version, current)
    local v = { version = version, textContent = r.text or "", createdAt = r.created_at, current = current or nil }
    if r.title then v.title = r.title end
    local c = decode(r.content)
    if c and c["$type"] then v.content = c end
    return v
  end
  local rows = exec("SELECT version, title, text, content::text AS content, created_at FROM ab_revisions WHERE key = $1 ORDER BY version", { item.key })
  for _, r in ipairs(rows) do table.insert(out, view(r, tonumber(r.version))) end
  table.insert(out, view({ title = item.title, text = item.text, content = item.content,
    created_at = item.updated_at or item.created_at }, #rows + 1, true))
  return { revisions = toarray(out) }
end
