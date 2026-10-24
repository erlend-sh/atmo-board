import { env } from '$env/dynamic/private';

/** The HappyView release this app's Lua scripts and spaces API target. */
export const EXPECTED_HAPPYVIEW = '2.16.0';

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set. See .env.example.`);
  return value;
}

/** Server configuration, read lazily so `vite build` works without a .env. */
export const config = {
  /** Where the web server reaches HappyView (private network in production). */
  get happyviewUrl() { return env.HAPPYVIEW_URL ?? 'http://127.0.0.1:3000'; },
  /** HappyView's SESSION_SECRET: signs the session cookies we mint per caller. */
  get sessionSecret() { return required('HAPPYVIEW_SESSION_SECRET'); },
  get clientKey() { return required('HAPPYVIEW_CLIENT_KEY'); },
  get clientSecret() { return env.HAPPYVIEW_CLIENT_SECRET; },
  /** The group account: the forum's DID. */
  get forumDid() { return required('ATMOBOARD_FORUM_DID'); },
  /** Signs the browser's own session cookie. */
  get cookieSecret() { return required('ATMOBOARD_COOKIE_SECRET'); },
  /** The public URL people use, e.g. https://forum.example. OAuth redirects come back here. */
  get appUrl() { return (env.ATMOBOARD_APP_URL ?? 'http://127.0.0.1:5173').replace(/\/+$/, ''); },
  /** Persistent directory for OAuth transactions and HappyView session keys. */
  get dataDir() { return env.DATA_DIR ?? 'data'; },
  /** Local demos only: lets anyone sign in as any member without a PDS. */
  get devLogin() { return env.ATMOBOARD_DEV_LOGIN === '1'; },
};
