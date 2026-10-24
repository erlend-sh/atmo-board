-- xrpc.procedure: dev.atmoboard.admin.removeMember
-- A ban, or someone leaving: the membership record goes, and so does their
-- access to every space. Their posts stay, as the authors' own records.
function handle()
  local denied = require_group_caller()
  if denied then return denied end
  local actor = input.actor
  local self_serve = actor == input.member
  if not self_serve and (not actor or not permissions(actor, nil).moderate) then
    return fail("Forbidden", "only staff remove other members")
  end
  if not member_row(input.member) then return fail("NotFound", "not a member") end
  if not self_serve and is_staff(roles_of(member_row(input.member))) and not permissions(actor, nil).admin then
    return fail("Forbidden", "only an admin removes staff")
  end
  exec("UPDATE ab_members SET left_at = $2 WHERE did = $1", { input.member, now() })
  local members = atproto.spaces.get(config("space_members"))
  pcall(function() members:delete_record{ collection = OS .. ".membership", rkey = input.member } end)
  for _, k in ipairs({ "space_meta", "space_members", "space_main", "space_staff" }) do
    local uri = config(k)
    if uri then pcall(function() atproto.spaces.get(uri):remove_member{ did = input.member } end) end
  end
  sync_spaces(input.member)
  if not self_serve then
    -- A ban is a forum-signed record, so it stays auditable.
    apply_override(actor, input.member, "ban", {}, input.reason)
  end
  log_change("member", input.member, nil, nil)
  return { member = input.member }
end
