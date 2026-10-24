// Railway's Infrastructure as Code. `railway config plan` previews changes
// and `railway config apply` makes them; railwayapp/config posts the plan on
// pull requests.
//
// Four services, as infra/release/compose.yml has them: Postgres, HappyView,
// the Caddy edge that keeps HappyView's /admin private, and the web app.
//
// Secrets are set once per environment in the dashboard and kept here with
// preserve(), because the CLI can't read them:
//   HAPPYVIEW_SESSION_SECRET, TOKEN_ENCRYPTION_KEY, ATMOBOARD_COOKIE_SECRET,
//   HAPPYVIEW_API_KEY, HAPPYVIEW_CLIENT_KEY, HAPPYVIEW_CLIENT_SECRET,
//   ATMOBOARD_FORUM_DID
// Each environment needs its own forum account: OAuth writes from staging
// would otherwise land in the production forum's real repo.
import { defineRailway, github, image, postgres, preserve, project, service, volume } from 'railway/iac';

const REPO = 'erlend-sh/atmo-board';
// Pinned together: the Lua scripts target this HappyView release, and the
// pre-deploy check refuses to start against a different one.
const HAPPYVIEW_IMAGE = 'ghcr.io/gamesgamesgamesgamesgames/happyview:2.16.0';

export default defineRailway((ctx) => {
  const prod = ctx.environment === 'production';
  const host = prod ? 'atmoboard.dev' : `${ctx.environment}.atmoboard.dev`;
  const appUrl = `https://${host}`;
  const happyviewUrl = `https://hv.${host}`;

  const db = postgres('postgres');

  const happyview = service('happyview', {
    // Private: only the edge and the web app reach it.
    source: image(HAPPYVIEW_IMAGE, { autoUpdates: { type: 'disabled' } }),
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      PUBLIC_URL: happyviewUrl,
      SESSION_SECRET: preserve(),
      TOKEN_ENCRYPTION_KEY: preserve(),
      RELAY_URL: 'https://relay1.us-east.bsky.network',
      PORT: '3000',
    },
  });

  // Railway's own edge can't block a path, and HappyView's /admin must never
  // be public. Everything else has to be, for OAuth and the spaces API.
  const edge = service('edge', {
    source: github(REPO, { branch: 'main', rootDirectory: 'infra/edge' }),
    domains: [{ domain: `hv.${host}`, port: 8080 }],
    env: {
      PORT: '8080',
      HAPPYVIEW_INTERNAL_URL: 'http://happyview.railway.internal:3000',
    },
  });

  // The OAuth session store. One volume means one replica, which is fine
  // until the store moves into Postgres.
  const data = volume('web-data', { sizeMB: 1024 });

  const web = service('web', {
    source: github(REPO, { branch: 'main' }),
    domains: [{ domain: host, port: 3000 }],
    volumeMounts: { '/data': data },
    // Lexicons, Lua endpoints and derived tables, plus the version and OAuth
    // client checks. A failure here keeps the old deploy serving.
    preDeploy: 'sh appview/container-setup.sh',
    healthcheck: '/api/version',
    healthcheckTimeout: 60,
    replicas: 1,
    env: {
      HAPPYVIEW_URL: 'http://happyview.railway.internal:3000',
      HAPPYVIEW_SESSION_SECRET: preserve(),
      HAPPYVIEW_CLIENT_KEY: preserve(),
      HAPPYVIEW_CLIENT_SECRET: preserve(),
      HAPPYVIEW_API_KEY: preserve(),
      HAPPYVIEW_EXPECTED_VERSION: '2.16.0',
      ATMOBOARD_APP_URL: appUrl,
      ATMOBOARD_FORUM_DID: preserve(),
      ATMOBOARD_COOKIE_SECRET: preserve(),
      // Never on a public instance: it would let anyone be anyone.
      ATMOBOARD_DEV_LOGIN: '0',
      DATA_DIR: '/data',
      // setup.sh runs psql directly here, so libpq reads these.
      DATABASE_URL: db.env.DATABASE_URL,
      PGHOST: db.env.PGHOST,
      PGPORT: db.env.PGPORT,
      PGUSER: db.env.PGUSER,
      PGPASSWORD: db.env.PGPASSWORD,
      PGDATABASE: db.env.PGDATABASE,
    },
  });

  return project('atmo-board', { resources: [db, happyview, edge, web] });
});
