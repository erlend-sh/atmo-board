-- xrpc.query: dev.atmoboard.getForum
function handle()
  local did = forum_did()
  if not did then return fail("NotInitialized", "this instance has no forum yet") end
  local forum = { did = did, name = config("name") or "atmo-board", joinPolicy = config("join_policy") or "open" }
  local d = config("description")
  if d and d ~= "" then forum.description = d end
  return { forum = forum, viewer = viewer_state(caller_did) }
end
