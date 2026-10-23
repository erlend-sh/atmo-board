#!/bin/sh
# Create the HappyView super user and mint an operator API key for it.
# Run once per instance, before appview/setup.sh. Adapted from atmoBB.
#
#   ADMIN_DID=did:plc:you sh appview/bootstrap-admin.sh >> .env
#
# Prints HAPPYVIEW_API_KEY=... once; only its hash is stored. Rerunning
# rotates the key.
set -eu
cd "$(dirname "$0")/.."
ADMIN_DID=${ADMIN_DID:?set ADMIN_DID to the DID that should own this HappyView}
PG_EXEC=${PG_EXEC-"docker compose exec -T postgres"}
PSQL="$PG_EXEC psql -U ${PGUSER:-happyview} -d ${PGDATABASE:-happyview}"

if ! printf '%s\n' "$ADMIN_DID" | grep -Eq '^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$'; then
  echo "ADMIN_DID must be a DID, not a handle" >&2
  exit 1
fi

echo "== waiting for HappyView migrations" >&2
attempt=0
until $PSQL -qAt -c "SELECT to_regclass('public.happyview_users') IS NOT NULL" 2>/dev/null | grep -qx t; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { echo "HappyView's schema was not ready after 2 minutes" >&2; exit 1; }
  sleep 2
done

TOKEN="hv_$(openssl rand -hex 24)"
HASH=$(printf '%s' "$TOKEN" | openssl dgst -sha256 -hex | awk '{print $NF}')
PREFIX=$(printf '%s' "$TOKEN" | cut -c1-7)
PERMISSIONS='["lexicons:create","lexicons:delete","scripts:manage","backfill:create","backfill:read","settings:manage","api-clients:view","api-clients:create","api-clients:edit"]'
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

$PSQL -q -c "
WITH u AS (
  INSERT INTO happyview_users (id, did, is_super, created_at)
  VALUES ('admin', '$ADMIN_DID', 1, '$NOW')
  ON CONFLICT (did) DO UPDATE SET is_super = 1
  RETURNING id
)
INSERT INTO happyview_api_keys (id, user_id, name, key_hash, key_prefix, permissions, created_at)
SELECT 'admin-key', u.id, 'atmo-board setup', '$HASH', '$PREFIX', '$PERMISSIONS', '$NOW' FROM u
ON CONFLICT (id) DO UPDATE
  SET key_hash = EXCLUDED.key_hash, key_prefix = EXCLUDED.key_prefix,
      user_id = EXCLUDED.user_id, permissions = EXCLUDED.permissions, revoked_at = NULL;" >&2

printf 'HAPPYVIEW_API_KEY=%s\n' "$TOKEN"
