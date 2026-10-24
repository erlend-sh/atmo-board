import { env } from '$env/dynamic/private';
import { config } from '../config';
import { OAuthConfigurationError, SecureHappyViewOAuth } from './happyview';

export { OAuthConfigurationError, FLOW_COOKIE } from './happyview';

// Sign-in only needs to prove who someone is: posts are written through
// HappyView's spaces, not to the member's PDS, so the grant is bare `atproto`.
export const SCOPE = 'atproto';

// With an https app URL the client_id is the hosted metadata document at
// /oauth-client-metadata.json. On plain http (local) it's atproto's loopback
// client, which needs no hosted document.
export function clientMetadata() {
  const base = config.appUrl;
  const redirectUri = `${base}/oauth/callback`;
  const local = base.startsWith('http://');
  return {
    client_id: local
      ? `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPE)}`
      : `${base}/oauth-client-metadata.json`,
    client_name: local ? 'atmo-board (dev)' : 'atmo-board',
    client_uri: base,
    redirect_uris: [redirectUri] as [string],
    scope: SCOPE,
    grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
    response_types: ['code'] as ['code'],
    application_type: 'web' as const,
    token_endpoint_auth_method: 'none' as const,
    dpop_bound_access_tokens: true,
  };
}

let cached: { key: string; instance: SecureHappyViewOAuth } | null = null;

export function oauthClient(): SecureHappyViewOAuth {
  const metadata = clientMetadata();
  const registered = env.HAPPYVIEW_OAUTH_CLIENT_ID;
  if (registered && registered !== metadata.client_id) {
    throw new OAuthConfigurationError('HAPPYVIEW_OAUTH_CLIENT_ID does not match this app URL. Update the HappyView API client and the environment together.');
  }
  const options = {
    instanceUrl: config.happyviewUrl.replace(/\/+$/, ''),
    appUrl: config.appUrl, clientId: metadata.client_id, clientKey: config.clientKey,
    redirectUri: metadata.redirect_uris[0], dataDir: config.dataDir,
  };
  const key = JSON.stringify(options);
  if (cached?.key !== key) cached = { key, instance: new SecureHappyViewOAuth(options) };
  return cached.instance;
}

/** Only same-site paths survive the round trip through the PDS. */
export function safeNext(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) && value.length < 500 ? value : undefined;
}
