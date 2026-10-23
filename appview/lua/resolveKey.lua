-- xrpc.query: dev.atmoboard.resolveKey
-- Where a key lives now. Backs /p/{key} and redirects of stale slugs.
function handle()
  local item = get_item(params.key)
  if not item then return fail("NotFound", "no such key") end
  if not permissions(caller_did, channel_of(item)).see then return fail("NotFound", "no such key") end
  if item.kind == "thread" then
    return { kind = truthy(item.is_channel) and "channel" or "thread", key = item.key, slug = item.slug }
  end
  local thread = get_item(item.thread_key)
  return { kind = "post", key = item.key, slug = thread.slug, thread = thread.key,
    threadSlug = thread.slug, number = tonumber(item.number) }
end
