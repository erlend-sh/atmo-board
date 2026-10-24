# Deploying atmo-board

One install is one forum. The stack is four services, the same on Railway and
in the Compose bundle:

| Service | Public? | What it is |
|---|---|---|
| **postgres** | No | HappyView's record store and our derived tables. Space content exists **only** here, so backups are not optional. |
| **happyview** | No | The appview: the XRPC API, the Lua endpoints and the permissioned spaces. |
| **edge** | Yes, at `hv.<domain>` | Caddy in front of HappyView. Its only job is to return 404 for `/admin*`, which Railway's own edge can't do. Everything else must stay public, because OAuth, the PDS service proxy and spaces all need a public hostname. |
| **web** | Yes, at `<domain>` | This repo: SvelteKit with adapter-node. It has a volume at `/data` for the OAuth session store, and a pre-deploy command that installs the lexicons, Lua endpoints and derived tables. |

You need two hostnames: `<domain>` for the forum and `hv.<domain>` for
HappyView. Both need TLS, because atproto OAuth refuses anything else.

## 1. Secrets

Per environment, once:

```sh
openssl rand -hex 32     # HAPPYVIEW_SESSION_SECRET (shared by happyview and web)
openssl rand -hex 32     # ATMOBOARD_COOKIE_SECRET
openssl rand -base64 32  # TOKEN_ENCRYPTION_KEY
```

Staging and production must never share a forum account: OAuth writes from
either land in real atproto repos.

## 2. Bring up Postgres and HappyView

**Railway:** `railway config apply` creates everything from
[`.railway/railway.ts`](../.railway/railway.ts). Set the secrets above on the
services first: the file marks them `preserve()`, so the CLI never reads or
overwrites them.

**Compose:** copy `infra/release/.env.release.example` to
`infra/release/.env`, fill it in, then
`docker compose -f infra/release/compose.yml up -d postgres happyview edge`.

## 3. Bootstrap HappyView and the forum

Run these once, against the new instance (on Railway, `railway run` in the
web service so you're on the private network):

```sh
# An operator key for HappyView's admin API. Store it as HAPPYVIEW_API_KEY.
ADMIN_DID=did:plc:you sh appview/bootstrap-admin.sh

# The OAuth client. Store both values it prints.
HV=https://hv.example.org ATMOBOARD_APP_URL=https://forum.example.org \
  HAPPYVIEW_API_KEY=... sh appview/register-oauth-client.sh

# Lexicons, Lua endpoints and derived tables. The web service also runs this
# before every deploy, so this first run is just to get ahead of it.
HV=https://hv.example.org PG_EXEC= HAPPYVIEW_API_KEY=... sh appview/setup.sh
```

Then create the forum itself, as the group account, with
`dev.atmoboard.admin.initForum` (`name`, `description`, `joinPolicy` and the
DID of the first admin). `appview/seed-dev.mjs` shows the call; for a real
forum, call it without the demo content.

## 4. Deploy the web app

Set on the web service: `HAPPYVIEW_URL` (private), `HAPPYVIEW_SESSION_SECRET`,
`HAPPYVIEW_CLIENT_KEY` and `HAPPYVIEW_CLIENT_SECRET`, `HAPPYVIEW_API_KEY`,
`ATMOBOARD_APP_URL`, `ATMOBOARD_FORUM_DID`, `ATMOBOARD_COOKIE_SECRET`,
`DATA_DIR=/data`, and libpq's `PG*` (or `DATABASE_URL`) so the pre-deploy
step can reach Postgres.

**Never set `ATMOBOARD_DEV_LOGIN=1` on a public instance.** It lets anyone
sign in as anyone.

The pre-deploy command, `sh appview/container-setup.sh`, checks HappyView's
version, checks that the OAuth client matches this deployment's URL, and runs
`setup.sh`. If it fails, the new deploy doesn't go live.

## Upgrading HappyView

HappyView's migrations are forward-only. Back up Postgres first, then bump
the image tag and `HAPPYVIEW_EXPECTED_VERSION` in the same release: the
pre-deploy check refuses to start the app against a version it wasn't built
for. (`HAPPYVIEW_VERSION_SKIP=1` overrides it, for when you know better.)

## Backups

- **Postgres** is the whole forum. Private channels and whispers exist
  nowhere else, so losing it loses them for good. Use Railway's backups, or a
  scheduled `pg_dump` to object storage.
- **The `/data` volume** holds the OAuth sessions. Losing it signs everyone
  out; it isn't fatal, but it's rude.

## Limits

- The `/data` volume pins the web service to one replica. Scaling out means
  moving the session store into Postgres first.
- Whispers and private channels rely on HappyView's permissioned spaces,
  which are an experimental polyfill of a draft proposal. That content lives
  only in your Postgres.
