import crypto from 'node:crypto';

export const X_SCOPES = Object.freeze(['tweet.read', 'tweet.write', 'users.read', 'offline.access']);
export const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
export const TOKEN_URL = 'https://api.x.com/2/oauth2/token';

function base64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createPkce() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' };
}

export function buildAuthorizeUrl({ clientId, redirectUri, state, scopes = X_SCOPES, codeChallenge }) {
  if (!clientId || !redirectUri || !state || !codeChallenge) throw new Error('OAuth PKCE parameters are required');
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
    scope: scopes.join(' '), state, code_challenge: codeChallenge, code_challenge_method: 'S256',
  });
  return url.toString();
}

async function tokenRequest(params, { clientId, clientSecret, fetchImpl = fetch } = {}) {
  const headers = { 'content-type': 'application/x-www-form-urlencoded' };
  const body = new URLSearchParams(params);
  if (clientSecret) {
    headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else if (clientId && !body.has('client_id')) {
    body.set('client_id', clientId);
  }
  const response = await fetchImpl(TOKEN_URL, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`x_token_${response.status}: ${sanitizeOAuthError(json)}`);
  return json;
}

export function exchangeCode({ code, redirectUri, codeVerifier, clientId, clientSecret, fetchImpl }) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: codeVerifier, ...(clientSecret ? {} : { client_id: clientId }) }, { clientId, clientSecret, fetchImpl });
}

export function refreshToken({ refreshToken: token, clientId, clientSecret, fetchImpl }) {
  return tokenRequest({ refresh_token: token, grant_type: 'refresh_token', ...(clientSecret ? {} : { client_id: clientId }) }, { clientId, clientSecret, fetchImpl });
}

function sanitizeOAuthError(body) {
  return String(body?.error_description || body?.error || 'token request failed').replace(/bearer\s+\S+/ig, 'bearer [redacted]').slice(0, 300);
}
