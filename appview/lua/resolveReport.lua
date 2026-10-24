-- xrpc.procedure: dev.atmoboard.resolveReport
-- Staff close a review item: agreed (the flag was right), disagreed (it
-- wasn't, so an automatic hide is lifted) or ignored.
function handle()
  if not permissions(caller_did, nil).moderate then return fail("Forbidden", "staff only") end
  local item = get_item(input.subject)
  if not item then return fail("NotFound", "no such post") end
  local status = input.status
  if status ~= "agreed" and status ~= "disagreed" and status ~= "ignored" then
    return fail("InvalidRequest", "status must be agreed, disagreed or ignored")
  end
  local n = exec([[UPDATE ab_reports SET status = $2, resolved_by = $3, resolved_at = $4
                   WHERE subject_key = $1 AND status = 'open' RETURNING reporter]],
    { item.key, status, caller_did, now() })
  -- Disagreeing lifts a hide the flags caused; a staff hide needs unhide.
  if status == "disagreed" and item.hidden_by == "flags" then
    exec("UPDATE ab_items SET hidden = false, hidden_by = NULL WHERE key = $1", { item.key })
    local tk, pk = thread_and_parent(item)
    log_change("override", item.key, tk, pk)
  end
  log_change("report", item.key, nil, nil)
  return { subject = item.key, status = status, resolved = #n }
end
