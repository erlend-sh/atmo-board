#!/bin/sh
# Configure a running HappyView for atmo-board: feature flags, derived tables,
# lexicons, and Lua scripts. Idempotent; run it after every deploy.
#
#   HV=http://127.0.0.1:3000 sh appview/setup.sh
#
# PG_EXEC runs psql: by default inside the Compose postgres service. Set it to
# the empty string to run psql directly with libpq's PG* variables (Railway).
set -eu
cd "$(dirname "$0")/.."

TOKEN=${HAPPYVIEW_API_KEY:-}
if [ -z "$TOKEN" ] && [ -f .env ]; then
  TOKEN=$(sed -n 's/^HAPPYVIEW_API_KEY=//p' .env | tail -n 1)
fi
[ -n "$TOKEN" ] || { echo "Set HAPPYVIEW_API_KEY (run appview/bootstrap-admin.sh first)" >&2; exit 1; }
for command in curl jq; do
  command -v "$command" >/dev/null 2>&1 || { echo "$command is required" >&2; exit 1; }
done
HV=${HV:-http://127.0.0.1:3000}
PG_EXEC=${PG_EXEC-"docker compose exec -T postgres"}

admin() {
  curl --connect-timeout 10 --max-time 60 --fail-with-body --silent --show-error \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"
}

echo "== feature flags"
admin -X PUT "$HV/admin/settings/feature.spaces_enabled" -d '{"value":"true"}' >/dev/null

echo "== derived tables"
$PG_EXEC psql -v ON_ERROR_STOP=1 -q -U "${PGUSER:-happyview}" -d "${PGDATABASE:-happyview}" < appview/schema.sql

echo "== lexicons"
# Records first (local upload, no network backfill: our records live in
# spaces, not public repos), then the queries and procedures they serve.
for file in $(find lexicons -name '*.json' | sort); do
  type=$(jq -r '.defs.main.type // "definitions"' "$file")
  case "$type" in
    record) order=1 ;;
    query|procedure) order=2 ;;
    *) order=0 ;;
  esac
  printf '%s %s\n' "$order" "$file"
done | sort | while read -r _ file; do
  body=$(jq -n --slurpfile lex "$file" '{lexicon_json: $lex[0], backfill: false}')
  printf '  %s: ' "$(jq -r .id "$file")"
  admin -X POST "$HV/admin/lexicons" -d "$body" | jq -c '{revision}'
done

echo "== scripts"
for file in appview/lua/*.lua; do
  name=$(basename "$file" .lua)
  [ "$name" = "_lib" ] && continue
  nsid="dev.atmoboard.$name"
  type=$(jq -r '.defs.main.type' "lexicons/$(printf '%s' "$nsid" | tr . /).json")
  body=$(cat appview/lua/_lib.lua "$file" | jq -Rs --arg id "xrpc.$type:$nsid" '{id: $id, body: .}')
  printf '  %s: ' "xrpc.$type:$nsid"
  admin -X POST "$HV/admin/scripts" -d "$body" | jq -c '{id}'
done

echo "== done"
