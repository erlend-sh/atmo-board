#!/bin/sh
# One-shot local demo: start Postgres and HappyView, configure them, and seed
# a demo forum. Safe to rerun; it keeps existing secrets and data.
#
#   sh appview/demo.sh && bun run dev
#
# Needs docker (with compose), curl, jq, openssl and node.
# SKIP_COMPOSE=1 uses a HappyView you started yourself on $HV.
set -eu
cd "$(dirname "$0")/.."
HV=${HV:-http://127.0.0.1:3000}
export HV

[ -f .env ] || cp .env.example .env
get() { sed -n "s/^$1=//p" .env | tail -n 1; }
put() {
  if grep -q "^$1=" .env; then
    tmp=$(mktemp); awk -v k="$1" -v v="$2" 'BEGIN{FS=OFS="="} $1==k{print k "=" v; next} {print}' .env > "$tmp" && mv "$tmp" .env
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}
[ -n "$(get HAPPYVIEW_SESSION_SECRET)" ] || put HAPPYVIEW_SESSION_SECRET "$(openssl rand -hex 32)"
[ -n "$(get TOKEN_ENCRYPTION_KEY)" ] || put TOKEN_ENCRYPTION_KEY "$(openssl rand -base64 32)"
[ -n "$(get ATMOBOARD_COOKIE_SECRET)" ] || put ATMOBOARD_COOKIE_SECRET "$(openssl rand -hex 32)"
[ -n "$(get ATMOBOARD_FORUM_DID)" ] || put ATMOBOARD_FORUM_DID did:plc:atmoboardforum0000000000

if [ -z "${SKIP_COMPOSE:-}" ]; then
  echo "== starting postgres and happyview"
  docker compose --env-file .env up -d
fi
echo "== waiting for HappyView"
i=0
until curl -fsS "$HV/health" >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -lt 90 ] || { echo "HappyView didn't come up on $HV" >&2; exit 1; }
  sleep 2
done

if [ -z "$(get HAPPYVIEW_API_KEY)" ]; then
  echo "== creating the HappyView operator key"
  key=$(ADMIN_DID=did:plc:alice0000000000000000000 sh appview/bootstrap-admin.sh | sed -n 's/^HAPPYVIEW_API_KEY=//p')
  put HAPPYVIEW_API_KEY "$key"
fi
HAPPYVIEW_API_KEY=$(get HAPPYVIEW_API_KEY) sh appview/setup.sh

if [ -z "$(get HAPPYVIEW_CLIENT_KEY)" ]; then
  echo "== registering the web app as an API client"
  # Locally the OAuth client is atproto's loopback client: its client_id is
  # this http://localhost URL, not a hosted metadata document.
  loopback='http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2Foauth%2Fcallback&scope=atproto'
  client=$(curl -fsS -X POST "$HV/admin/api-clients" -H "Authorization: Bearer $(get HAPPYVIEW_API_KEY)" \
    -H 'content-type: application/json' -d "{\"name\":\"atmo-board web\",\"client_id_url\":\"$loopback\",\"client_uri\":\"http://127.0.0.1:5173\",\"redirect_uris\":[\"http://127.0.0.1:5173/oauth/callback\"],\"scopes\":\"atproto\"}")
  put HAPPYVIEW_CLIENT_KEY "$(printf '%s' "$client" | jq -r .client_key)"
  put HAPPYVIEW_CLIENT_SECRET "$(printf '%s' "$client" | jq -r .client_secret)"
fi

echo "== seeding the demo forum"
node appview/seed-dev.mjs
echo
echo "Ready. Run 'bun run dev' and open http://127.0.0.1:5173"
