-- xrpc.procedure: dev.atmoboard.report
-- Discourse's flags, and the opensocial proposal's createReport: private
-- host state, not a public record. Enough agreeing flags from trusted
-- members hide a post until staff review it.
local HIDE_AT = 3

function handle()
  if not caller_did then return fail("Forbidden", "sign in first") end
  local perms_self = permissions(caller_did, nil)
  if not perms_self.flag then return fail("Forbidden", "new members can't flag yet") end
  local item = get_item(input.subject)
  if not item then return fail("NotFound", "no such post") end
  local perms = permissions(caller_did, channel_of(item))
  if not perms.see or (truthy(item.whisper) and not perms.moderate) then return fail("NotFound", "no such post") end
  if item.author == caller_did then return fail("InvalidRequest", "you can't flag your own post") end
  local reason = input.reason
  if reason ~= "spam" and reason ~= "offtopic" and reason ~= "inappropriate" and reason ~= "other" then
    return fail("InvalidRequest", "reason must be spam, offtopic, inappropriate or other")
  end
  exec([[INSERT INTO ab_reports (subject_key, reporter, reason, note, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (subject_key, reporter) DO UPDATE SET reason = $3, note = $4, created_at = $5,
           -- Flagging again after staff settled it opens a fresh complaint.
           status = 'open', resolved_by = NULL, resolved_at = NULL]],
    P(item.key, caller_did, reason, input.note, now()))
  local open = tonumber(one("SELECT count(*) AS n FROM ab_reports WHERE subject_key = $1 AND status = 'open'",
    { item.key }).n)
  -- Community hide: the post goes out of sight until staff decide.
  local hidden = truthy(item.hidden)
  if not hidden and open >= HIDE_AT and not is_staff(roles_of(member_row(item.author))) then
    exec("UPDATE ab_items SET hidden = true, hidden_by = 'flags' WHERE key = $1", { item.key })
    local tk, pk = thread_and_parent(item)
    log_change("override", item.key, tk, pk)
    hidden = true
  end
  log_change("report", item.key, nil, nil)
  return { subject = item.key, reports = open, hidden = hidden }
end
