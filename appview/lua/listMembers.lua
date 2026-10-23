-- xrpc.query: dev.atmoboard.listMembers
function handle()
  local limit = math.min(tonumber(params.limit) or 50, 100)
  local offset = tonumber(params.cursor) or 0
  local rows = exec([[
    SELECT did AS author, handle AS author_handle, display_name AS author_name, avatar AS author_avatar,
           roles::text AS author_roles, trust_level AS author_tl
    FROM ab_members WHERE left_at IS NULL ORDER BY joined_at DESC, did LIMIT $1 OFFSET $2]], P(limit + 1, offset))
  local members = {}
  for i, row in ipairs(rows) do
    if i <= limit then table.insert(members, author_view(row)) end
  end
  local out = { members = toarray(members) }
  if #rows > limit then out.cursor = tostring(offset + limit) end
  return out
end
