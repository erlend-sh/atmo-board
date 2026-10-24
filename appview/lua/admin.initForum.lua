-- xrpc.procedure: dev.atmoboard.admin.initForum
-- Called by the group account. Creates the group's spaces (meta, members,
-- and the forum's main modality space), its profile, the default roles, and
-- the first admin. Safe to call again: it only fills in what is missing.
function handle()
  if not caller_did then return fail("Forbidden", "authentication required") end
  local existing = forum_did()
  if existing and existing ~= caller_did then
    return fail("Forbidden", "this instance already belongs to " .. existing)
  end
  set_config("forum_did", caller_did)

  local function ensure(cfg, type, skey, read_policy, name)
    local uri = config(cfg)
    local sp = uri and atproto.spaces.get(uri) or nil
    if not sp then
      sp = atproto.spaces.create{ type = type, skey = skey, display_name = name,
        read_policy = read_policy, write_policy = MEMBER_LIST }
      set_config(cfg, sp.uri)
    end
    return sp
  end
  local name = input.name
  local meta = ensure("space_meta", OS .. ".meta", "self", PUBLIC, name)
  local members = ensure("space_members", OS .. ".members", "self", MEMBER_LIST, name .. " members")
  local main = ensure("space_main", SPACE_TYPE, "main", PUBLIC, name)
  -- Whispers: staff-only posts, so a space only staff can read.
  local staff = ensure("space_staff", SPACE_TYPE, "staff", MEMBER_LIST, name .. " staff")

  local join = input.joinPolicy or "open"
  meta:put_record{ collection = OS .. ".profile", rkey = "self", record = {
    ["$type"] = OS .. ".profile", displayName = name, description = input.description, joinPolicy = join } }
  meta:put_record{ collection = OS .. ".access", rkey = "self", record = {
    ["$type"] = OS .. ".access", public = true, grants = { { role = "member", scopes = { "read" } } } } }
  members:put_record{ collection = OS .. ".access", rkey = "self", record = {
    ["$type"] = OS .. ".access", public = false, grants = { { role = "member", scopes = { "read" } } } } }
  main:put_record{ collection = OS .. ".access", rkey = "self", record = {
    ["$type"] = OS .. ".access", public = true, grants = { { role = "member", scopes = { "read", "write" } } } } }
  staff:put_record{ collection = OS .. ".access", rkey = "self", record = {
    ["$type"] = OS .. ".access", public = false, grants = {
      { role = "moderator", scopes = { "read", "write" } }, { role = "admin", scopes = { "read", "write" } } } } }
  for _, r in ipairs({
    { id = "admin", name = "Admin" }, { id = "moderator", name = "Moderator" },
    { id = "member", name = "Member", default = true },
    -- Trust levels are roles in the group model; the appview grants them.
    { id = "tl0", name = "New" }, { id = "tl1", name = "Basic" }, { id = "tl2", name = "Member" },
    { id = "tl3", name = "Regular" }, { id = "tl4", name = "Leader" } }) do
    members:put_record{ collection = OS .. ".role", rkey = r.id, record = {
      ["$type"] = OS .. ".role", displayName = r.name, default = r.default or false } }
  end
  set_config("name", name)
  set_config("description", input.description or "")
  set_config("join_policy", join)

  put_membership(input.admin, { "admin", "member" }, { trustLevel = 4, handle = input.adminHandle })
  return { did = caller_did, spaces = { meta = meta.uri, members = members.uri, main = main.uri, staff = staff.uri } }
end
