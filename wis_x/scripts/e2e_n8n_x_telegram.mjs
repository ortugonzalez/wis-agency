import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS X - E2E X OAuth + Telegram (One Shot)';
const webhookPath = 'wis-x/e2e-x-oauth-telegram';
const telegramChatId = '7512675688';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}:${JSON.stringify(json).slice(0, 500)}`);
  return json;
}

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-wis-x`, name, type, typeVersion, position, parameters, ...extra };
}

const draft = 'E2E WIS X: autenticación OAuth validada y circuito listo. Esta prueba es DRY-RUN: no publica en X.';
const nodes = [
  node('E2E Webhook', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} }, { webhookId: 'wis-x-e2e-x-oauth-telegram' }),
  node('X GET users me', 'n8n-nodes-base.httpRequest', 4.2, [280, 0], {
    method: 'GET',
    url: 'https://api.x.com/2/users/me',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'twitterOAuth2Api',
    options: {},
  }, { credentials: { twitterOAuth2Api: { name: 'X account' } } }),
  node('Preparar mensaje E2E', 'n8n-nodes-base.code', 2, [560, 0], {
    jsCode: `return [{ json: { ok_x_auth: true, x_user_id: $json.data?.id || null, x_username: $json.data?.username || null, dry_run: true, draft: ${JSON.stringify(draft)} } }];`,
  }),
  node('Enviar resultado E2E por Telegram', 'n8n-nodes-base.telegram', 1.2, [840, 0], {
    operation: 'sendMessage',
    chatId: telegramChatId,
    text: '={{ `E2E WIS X OK\\nUsuario X: @${$json.x_username || "no disponible"}\\nID: ${$json.x_user_id || "no disponible"}\\n\\n${$json.draft}\\n\\nNo se publicó en X.` }}',
    additionalFields: {},
  }, { credentials: { telegramApi: { id: env.N8N_TELEGRAM_CREDENTIAL_ID, name: env.N8N_TELEGRAM_CREDENTIAL_NAME || 'Telegram account' } } }),
  node('Responder E2E', 'n8n-nodes-base.respondToWebhook', 1.4, [1120, 0], { respondWith: 'json', responseBody: '={{ { ok: true, dry_run: true, x_user: $json.x_username, telegram_message_id: $json.result?.message_id || null } }}', options: { responseCode: 200 } }),
];

const body = {
  name: workflowName,
  nodes,
  connections: {
    'E2E Webhook': { main: [[{ node: 'X GET users me', type: 'main', index: 0 }]] },
    'X GET users me': { main: [[{ node: 'Preparar mensaje E2E', type: 'main', index: 0 }]] },
    'Preparar mensaje E2E': { main: [[{ node: 'Enviar resultado E2E por Telegram', type: 'main', index: 0 }]] },
    'Enviar resultado E2E por Telegram': { main: [[{ node: 'Responder E2E', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' },
};

const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === workflowName);
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });

await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
try {
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(90000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`webhook_${response.status}:${raw.slice(0, 500)}`);
  console.log(JSON.stringify({ ok: true, workflow_id: saved.id, workflow_name: workflowName, response: JSON.parse(raw), dry_run: true }));
} finally {
  await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
}
