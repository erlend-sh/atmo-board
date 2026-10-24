-- xrpc.procedure: dev.atmoboard.admin.addMember
-- Called by the group account on behalf of the web app, after it has
-- verified the member's identity (and, for approval or invite forums, that
-- they were admitted). Roles beyond "member" need an admin actor, and
-- changing staff roles re-syncs the member's access to the staff space and
-- the private channels.
function handle()
  local denied = require_group_caller()
  if denied then return denied end
  local roles = input.roles or { "member" }
  if not has_role(roles, "member") then table.insert(roles, "member") end
  for _, r in ipairs(roles) do
    if r ~= "member" then
      if not input.actor or not has_role(roles_of(member_row(input.actor)), "admin") then
        return fail("Forbidden", "only an admin can grant " .. r)
      end
    end
  end
  local level = input.trustLevel and math.max(0, math.min(4, math.floor(tonumber(input.trustLevel) or 0))) or nil
  if level and (not input.actor or not permissions(input.actor, nil).moderate) then
    return fail("Forbidden", "only staff set trust levels")
  end
  put_membership(input.member, roles, { handle = input.handle, displayName = input.displayName,
    avatar = input.avatar, trustLevel = level })
  log_change("member", input.member, nil, nil)
  return { member = input.member, roles = toarray(roles) }
end
