import { refreshToken } from './oauth.mjs';
import { validateText } from './text.mjs';

export class XApiError extends Error {
  constructor(message, { status = 0, body = {}, headers = {}, uncertain = false } = {}) {
    super(message);
    this.name = 'XApiError';
    this.status = status;
    this.body = sanitizeBody(body);
    this.rateLimit = {
      limit: headers.get?.('x-rate-limit-limit') || null,
      remaining: headers.get?.('x-rate-limit-remaining') || null,
      reset: headers.get?.('x-rate-limit-reset') || null,
    };
    this.uncertain = uncertain;
  }
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};
  const copy = structuredClone(body);
  for (const key of Object.keys(copy)) {
    if (/token|secret|authorization/i.test(key)) copy[key] = '[redacted]';
  }
  return copy;
}

export class XApiClient {
  constructor({ accessToken, refreshTokenValue, clientId, clientSecret, fetchImpl = fetch, onTokenRotated = () => {} } = {}) {
    this.accessToken = accessToken || '';
    this.refreshTokenValue = refreshTokenValue || '';
    this.clientId = clientId || '';
    this.clientSecret = clientSecret || '';
    this.fetchImpl = fetchImpl;
    this.onTokenRotated = onTokenRotated;
  }

  async request(path, { method = 'GET', body, retryAuth = true } = {}) {
    const headers = { authorization: `Bearer ${this.accessToken}`, accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    let response;
    try {
      response = await this.fetchImpl(`https://api.x.com${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      throw new XApiError('x_request_timeout_or_network_error', { uncertain: method !== 'GET' });
    }
    const json = await response.json().catch(() => ({}));
    if (response.status === 401 && retryAuth && this.refreshTokenValue) {
      const tokenSet = await refreshToken({ refreshToken: this.refreshTokenValue, clientId: this.clientId, clientSecret: this.clientSecret, fetchImpl: this.fetchImpl });
      this.accessToken = tokenSet.access_token || this.accessToken;
      this.refreshTokenValue = tokenSet.refresh_token || this.refreshTokenValue;
      await this.onTokenRotated(tokenSet);
      return this.request(path, { method, body, retryAuth: false });
    }
    if (!response.ok) {
      const uncertain = method !== 'GET' && (response.status >= 500 || response.status === 408);
      throw new XApiError(`x_api_${response.status}`, { status: response.status, body: json, headers: response.headers, uncertain });
    }
    return { data: json, headers: response.headers, status: response.status };
  }

  health() { return this.request('/2/users/me'); }

  createPost(text, inReplyToTweetId = null) {
    const checked = validateText(text);
    if (!checked.valid) throw new XApiError(`invalid_text_${checked.reason}`, { status: 400, body: checked });
    const body = { text: checked.text };
    if (inReplyToTweetId) body.reply = { in_reply_to_tweet_id: String(inReplyToTweetId) };
    return this.request('/2/tweets', { method: 'POST', body });
  }

  getPost(id) { return this.request(`/2/tweets/${encodeURIComponent(id)}`); }
}
