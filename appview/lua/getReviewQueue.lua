-- xrpc.query: dev.atmoboard.getReviewQueue
-- Staff only: reported posts, newest first, with their reports. Discourse's
-- /review. Resolved items are included with status=all.
function handle()
  if not permissions(caller_did, nil).moderate then return fail("Forbidden", "staff only") end
  local status = params.status or "open"
  local limit = math.min(tonumber(params.limit) or 25, 100)
  local offset = tonumber(params.cursor) or 0
  local where = status == "all" and "true" or "r.status = $1"
  local args = status == "all" and {} or { status }
  table.insert(args, limit + 1)
  table.insert(args, offset)
  local rows = exec([[
    SELECT r.subject_key, max(r.created_at) AS latest
    FROM ab_reports r WHERE ]] .. where .. [[
    GROUP BY r.subject_key ORDER BY latest DESC LIMIT $]] .. (#args - 1) .. " OFFSET $" .. #args, args)
  local items = {}
  for i, row in ipairs(rows) do
    if i > limit then break end
    local item = get_item(row.subject_key)
    if item then
      local reports = {}
      for _, rep in ipairs(exec([[
        SELECT r.reporter, r.reason, r.note, r.status, r.created_at, r.resolved_by, r.resolved_at,
               m.handle, m.display_name, m.avatar, m.roles::text AS roles, m.trust_level
        FROM ab_reports r LEFT JOIN ab_members m ON m.did = r.reporter
        WHERE r.subject_key = $1 ORDER BY r.created_at]], { item.key })) do
        local v = { reason = rep.reason, status = rep.status, createdAt = rep.created_at,
          reporter = author_view({ author = rep.reporter, author_handle = rep.handle,
            author_name = rep.display_name, author_avatar = rep.avatar, author_roles = rep.roles,
            author_tl = rep.trust_level }) }
        if rep.note then v.note = rep.note end
        if rep.resolved_by then v.resolvedBy = rep.resolved_by end
        if rep.resolved_at then v.resolvedAt = rep.resolved_at end
        table.insert(reports, v)
      end
      local thread = item.kind == "post" and get_item(item.thread_key) or item
      local entry = { subject = item.key, reports = toarray(reports),
        post = item.kind == "post" and post_view(item, caller_did, true) or opening_post_view(item, caller_did, true) }
      if thread then entry.thread = thread_view(thread, caller_did, true) end
      table.insert(items, entry)
    end
  end
  local out = { items = toarray(items) }
  if #rows > limit then out.cursor = tostring(offset + limit) end
  return out
end
