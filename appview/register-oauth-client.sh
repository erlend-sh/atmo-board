#!/bin/sh
# Register (or re-register) the web app as a HappyView API client, which is
# also its OAuth client. Run once per deployment, and again if the forum's
# public URL changes.
#
#   HV=https://hv.example.org ATMOBOARD_APP_URL=https://forum.example.org \
#   HAPPYVIEW_API_KEY=... sh appview/register-oauth-client.sh
#
# Prints HAPPYVIEW_CLIENT_KEY and HAPPYVIEW_CLIENT_SECRET once.
set -eu
HV=${HV:-${HAPPYVIEW_URL:-http://127.0.0.1:3000}}
TOKEN=${HAPPYVIEW_API_KEY:?run appview/bootstrap-admin.sh first}
APP=${ATMOBOARD_APP_URL:?set ATMOBOARD_APP_URL to the public URL of the forum}
APP=$(printf '%s' "$APP" | sed 's#/*$##')

case "$APP" in
  https://*) client_id="$APP/oauth-client-metadata.json" ;;
  # atproto's loopback client: local development needs no hosted document.
  *) client_id="http://localhost?redirect_uri=$(printf '%s' "$APP/oauth/callback" | jq -sRr @uri)&scope=atproto" ;;
esac

body=$(jq -n --arg name "atmo-board web" --arg id "$client_id" --arg uri "$APP" --arg redirect "$APP/oauth/callback" \
  '{name: $name, client_id_url: $id, client_uri: $uri, redirect_uris: [$redirect], scopes: "atproto"}')
curl -fsS -X POST "$HV/admin/api-clients" -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d "$body" \
  | jq -r '"HAPPYVIEW_CLIENT_KEY=" + .client_key, "HAPPYVIEW_CLIENT_SECRET=" + (.client_secret // "")'
