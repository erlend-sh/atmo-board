-- xrpc.procedure: dev.atmoboard.moderate
-- Curation and moderation, Discourse's ladder: TL3 renames and moves
-- threads, TL4 also pins, locks and hides, staff do everything including
-- trust levels. Called as the group account on behalf of actor (the web app
-- is the group's shared application session), so the override record is
-- forum-signed and names who decided.
local NEEDS = { rename = "curate", move = "curate", pin = "manage", unpin = "manage", lock = "manage",
  unlock = "manage", hide = "manage", unhide = "manage", setTrustLevel = "moderate" }

function handle()
  local denied = require_group_caller()
  if denied then return denied end
  local actor, action = input.actor, input.action
  if not actor or not member_row(actor) then return fail("Forbidden", "actor must be a member") end
  local need = NEEDS[action]
  if not need then return fail("InvalidRequest", "unknown action " .. tostring(action)) end

  if action == "setTrustLevel" then
    if not permissions(actor, nil).moderate then return fail("Forbidden", "only staff set trust levels") end
    local level = tonumber(input.level)
    if not level or level < 0 or level > 4 then return fail("InvalidRequest", "level must be 0 to 4") end
    if not member_row(input.subject) then return fail("NotFound", "not a member") end
    -- Staff decisions stick: a set level is locked unless they say otherwise.
    local locked = input.locked ~= false
    local uri = apply_override(actor, input.subject, action, { level = level, locked = locked }, input.reason)
    return { uri = uri, subject = input.subject, action = action }
  end

  local item = get_item(input.subject)
  if not item then return fail("NotFound", "no such thread or post") end
  local perms = permissions(actor, channel_of(item))
  if not perms[need] then return fail("Forbidden", "you can't " .. action .. " this") end
  local detail = {}
  if action == "rename" or action == "move" or action == "pin" or action == "unpin" or action == "lock" or action == "unlock" then
    if item.kind ~= "thread" then return fail("InvalidRequest", "only threads can be " .. action .. "ed") end
  end
  if truthy(item.is_channel) and (action == "move" or action == "hide") then
    return fail("InvalidRequest", "channels are managed from the admin page")
  end
  if action == "rename" then
    local title = input.title and string.match(input.title, "^%s*(.-)%s*$") or ""
    if title == "" then return fail("InvalidRequest", "a title is required") end
    detail.title = title
  elseif action == "move" then
    local to = get_item(input.toThread or "")
    if not to or to.kind ~= "thread" then return fail("NotFound", "no such destination") end
    if to.key == item.key or to.key == item.parent_key then return fail("InvalidRequest", "it's already there") end
    -- No cycles: the destination can't be inside the thread being moved.
    local k = to.parent_key
    while k do
      if k == item.key then return fail("InvalidRequest", "can't move a thread inside itself") end
      local up = one("SELECT parent_key FROM ab_items WHERE key = $1", { k })
      k = up and up.parent_key or nil
    end
    if not permissions(actor, channel_of(to)).create then return fail("Forbidden", "you can't post there") end
    -- Records stay where they were written, so a move can't cross spaces.
    if to.space ~= item.space then return fail("InvalidRequest", "moving between private and public channels isn't supported yet") end
    detail.to, detail.toUri, detail.from = to.key, to.uri, item.parent_key
  end
  local uri = apply_override(actor, item.key, action, detail, input.reason)
  if action == "hide" or action == "unhide" then
    -- A staff decision settles any open reports on it.
    exec([[UPDATE ab_reports SET status = $2, resolved_by = $3, resolved_at = $4
           WHERE subject_key = $1 AND status = 'open']],
      { item.key, action == "hide" and "agreed" or "disagreed", actor, now() })
  end
  return { uri = uri, subject = item.key, action = action }
end
