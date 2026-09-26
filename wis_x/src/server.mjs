import http from 'node:http';
import { XApiClient } from './x-api.mjs';
import { publishApproved, reconcilePublishedPart } from './publisher.mjs';
import { refreshToken } from './oauth.mjs';
import { SupabaseStore } from './store.mjs';
import { validatePosts, validateText } from './text.mjs';

const port = Number(process.env.PORT || 8600);
const botSecret = process.env.BOT_SECRET || '';
const maxBody = 256 * 1024;
let accessToken = process.env.X_ACCESS_TOKEN || '';
let refreshTokenValue = process.env.X_REFRESH_TOKEN || '';
let store;
try { store = new SupabaseStore(); } catch { store = null; }

function api() {
  return new XApiClient({
    accessToken, refreshTokenValue,
    clientId: process.env.X_CLIENT_ID, clientSecret: process.env.X_CLIENT_SECRET,
    onTokenRotated: async (tokens) => { accessToken = tokens.access_token || accessToken; refreshTokenValue = tokens.refresh_token || refreshTokenValue; },
  });
}

function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function safeError(error) { return String(error?.message || error || 'unknown').replace(/bearer\s+\S+/ig, 'bearer [redacted]').slice(0, 500); }
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > maxBody) throw new Error('request_too_large'); }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, platform: 'x', dry_run_default: process.env.X_DRY_RUN !== 'false' });
    if (req.headers['x-bot-secret'] !== botSecret || !botSecret) return json(res, 401, { ok: false, error: 'unauthorized' });
    if (req.method === 'GET' && req.url === '/auth/health') {
      const result = await api().health();
      return json(res, 200, { ok: true, account: result.data?.data || null, rate_limit: Object.fromEntries(result.headers.entries()) });
    }
    if (req.method === 'POST' && req.url === '/auth/refresh') {
      const tokens = await refreshToken({ refreshToken: refreshTokenValue, clientId: process.env.X_CLIENT_ID, clientSecret: process.env.X_CLIENT_SECRET });
      accessToken = tokens.access_token || accessToken; refreshTokenValue = tokens.refresh_token || refreshTokenValue;
      return json(res, 200, { ok: true, refreshed: true });
    }
    if (req.method === 'POST' && req.url === '/validate') {
      const body = await readBody(req);
      const result = Array.isArray(body.posts) ? validatePosts(body.posts) : validateText(body.text);
      return json(res, result.valid ? 200 : 422, result);
    }
    if (req.method === 'POST' && req.url === '/publish') {
      const body = await readBody(req);
      if (!store) return json(res, 503, { ok: false, error: 'publisher_store_not_configured' });
      const productionGate = process.env.X_SYSTEM_ENABLED === 'true' && process.env.X_AUTO_PUBLISH_ONE_SHOT === 'true';
      const result = await publishApproved({ pendingPostId: Number(body.pending_post_id), posts: body.posts, username: process.env.X_USERNAME || body.username, api: api(), store, dryRun: !productionGate || body.dry_run !== false });
      return json(res, result.ok ? 200 : 409, result);
    }
    if (req.method === 'POST' && req.url === '/reconcile') {
      if (!store) return json(res, 503, { ok: false, error: 'publisher_store_not_configured' });
      const body = await readBody(req);
      const result = await reconcilePublishedPart({ pendingPostId: Number(body.pending_post_id), sequence: Number(body.sequence), xPostId: String(body.x_post_id), username: process.env.X_USERNAME || body.username, api: api(), store });
      return json(res, result.ok ? 200 : 404, result);
    }
    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (error) { return json(res, 500, { ok: false, error: safeError(error) }); }
});

server.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'server_started', port })));
