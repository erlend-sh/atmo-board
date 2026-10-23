-- xrpc.query: dev.atmoboard.getSidebar
-- Channels the viewer can see, grouped by section in position order.
-- unreadCount counts unread untitled-chat posts plus threads with unread posts.
function handle()
  local rows = exec(CHANNEL_SQL .. " ORDER BY c.position, i.created_at")
  local sections, order = {}, {}
  for _, row in ipairs(rows) do
    if permissions(caller_did, row.key).see then
      if caller_did then
        local u = one([[
          SELECT GREATEST(0, i.post_count - COALESCE(r.last_read, 0)) +
                 (SELECT count(*) FROM ab_items t
                    LEFT JOIN ab_reads tr ON tr.thread_key = t.key AND tr.did = $2
                  WHERE t.parent_key = i.key AND t.kind = 'thread' AND NOT t.deleted AND NOT t.hidden
                    AND t.post_count > COALESCE(tr.last_read, 0)) AS n
          FROM ab_items i LEFT JOIN ab_reads r ON r.thread_key = i.key AND r.did = $2
          WHERE i.key = $1]], { row.key, caller_did })
        row.unread = u and u.n or 0
      end
      local name = row.section or ""
      if not sections[name] then
        sections[name] = { name = name, channels = {} }
        table.insert(order, name)
      end
      table.insert(sections[name].channels, channel_view(row, caller_did))
    end
  end
  local out = {}
  for _, name in ipairs(order) do table.insert(out, sections[name]) end
  return { sections = toarray(out), cursor = change_cursor() }
end
