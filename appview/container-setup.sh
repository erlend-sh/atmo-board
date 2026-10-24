#!/bin/sh
# The web service's pre-deploy step. It runs in the app image, on the private
# network, before the new deploy goes live: if it fails, the old one stays up.
#
# It checks HappyView's version, makes sure the OAuth API client matches this
# deployment's URLs, and then runs the idempotent setup.sh (lexicons, Lua
# endpoints, derived tables).
#
# Needs HAPPYVIEW_URL, HAPPYVIEW_API_KEY, ATMOBOARD_APP_URL and libpq's PG*
# variables (or DATABASE_URL).
set -eu
cd "$(dirname "$0")/.."

HV=${HAPPYVIEW_URL:?set HAPPYVIEW_URL to the private HappyView URL}
EXPECTED=${HAPPYVIEW_EXPECTED_VERSION:-2.16.0}
APP=${ATMOBOARD_APP_URL:?set ATMOBOARD_APP_URL to the public URL of the forum}
APP=$(printf '%s' "$APP" | sed 's#/*$##')

echo "== waiting for HappyView at $HV"
i=0
until curl -fsS --max-time 5 "$HV/xrpc/_health" >/dev/null 2>&1 || curl -fsS --max-time 5 "$HV/" >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || { echo "HappyView did not come up" >&2; exit 1; }
  sleep 2
done

version=$(curl -fsS --max-time 10 "$HV/xrpc/_health" 2>/dev/null | jq -r '.version // empty' || true)
if [ -n "$version" ] && [ "$version" != "$EXPECTED" ]; then
  echo "HappyView is $version, but this release targets $EXPECTED." >&2
  echo "Back up Postgres, then deploy a matching pair (migrations are forward-only)." >&2
  [ "${HAPPYVIEW_VERSION_SKIP:-}" = "1" ] || exit 1
fi

# The OAuth client_id must match the app's public URL, or sign-in breaks in a
# way that only shows up at the PDS. Check it here instead.
if [ -n "${HAPPYVIEW_CLIENT_KEY:-}" ] && [ -n "${HAPPYVIEW_API_KEY:-}" ]; then
  want="$APP/oauth-client-metadata.json"
  have=$(curl -fsS --max-time 10 -H "Authorization: Bearer $HAPPYVIEW_API_KEY" "$HV/admin/api-clients" \
    | jq -r --arg k "$HAPPYVIEW_CLIENT_KEY" '.[] | select(.client_key == $k) | .client_id_url' || true)
  if [ -z "$have" ]; then
    echo "HAPPYVIEW_CLIENT_KEY is not a registered API client on this HappyView." >&2
    exit 1
  fi
  if [ "$have" != "$want" ]; then
    echo "The OAuth client is registered as $have, but this deployment is $want." >&2
    echo "Update the API client's client_id_url and redirect_uris, then redeploy." >&2
    exit 1
  fi
fi

HV="$HV" PG_EXEC= sh appview/setup.sh
echo "== pre-deploy setup done"
