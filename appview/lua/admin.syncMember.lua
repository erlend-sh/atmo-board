-- xrpc.procedure: dev.atmoboard.admin.syncMember
-- Recompute a member's trust level and republish their membership (roles,
-- including the tl0..tl4 role) and space access. The web app calls it as the
-- group account when markRead reports a new level.
function handle()
  local denied = require_group_caller()
  if denied then return denied end
  if not member_row(input.member) then return fail("NotFound", "not a member") end
  refresh_trust(input.member)
  publish_membership(input.member)
  local m = member_row(input.member)
  return { member = input.member, trustLevel = tonumber(m.trust_level) or 0 }
end
