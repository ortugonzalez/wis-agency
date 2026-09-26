import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const postId = Number(process.argv[2] || 0);
if (!postId) throw new Error('Uso: node check_linkedin_post_state.mjs POST_ID');

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS LinkedIn - Consulta segura de publicación';
const webhookPath = 'wis-linkedin/check-post-state';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${raw}`);
  return raw ? JSON.parse(raw) : {};
}

function makeNode(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}

function edge(target) {
  return [{ node: target, type: 'main', index: 0 }];
}

async function botSecret() {
  const list = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('missing_bot_secret');
}

async function ensureWorkflow() {
  const inbound = await api('/workflows/nEzq5nGzYQ663wXM');
  const configTemplate = inbound.nodes.find((item) => item.name === 'Get Config Inbound');
  const supabaseCredentials = inbound.nodes.find((item) => item.name === 'Patch estado=aprobado')?.credentials;
  if (!configTemplate || !supabaseCredentials) throw new Error('missing_templates');

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Check Config';
  getConfig.position = [220, 0];

  const nodes = [
    makeNode('Webhook Check Post', 'n8n-nodes-base.webhook', 2, [0, 0], {
      httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    makeNode('Validate Check', 'n8n-nodes-base.code', 2, [440, 0], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Check Post').first().json;
const post_id = Number(req.body?.post_id || 0);
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'CHECK_LINKEDIN_POST' && post_id > 0;
if (!authorized) throw new Error('unauthorized');
return [{ json: { post_id } }];` }),
    makeNode('Get Post', 'n8n-nodes-base.supabase', 1, [660, 0], {
      operation: 'getAll', tableId: 'posts_pending', returnAll: false, filterType: 'manual',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Check').first().json.post_id }}" }] },
      limit: 1,
    }, { credentials: structuredClone(supabaseCredentials), alwaysOutputData: true, onError: 'stopWorkflow' }),
    makeNode('Respond Check', 'n8n-nodes-base.respondToWebhook', 1.4, [880, 0], {
      respondWith: 'json',
      responseBody: '={{ $json }}',
      options: { responseCode: 200 },
    }),
  ];
  const connections = {
    'Webhook Check Post': { main: [edge('Get Check Config')] },
    'Get Check Config': { main: [edge('Validate Check')] },
    'Validate Check': { main: [edge('Get Post')] },
    'Get Post': { main: [edge('Respond Check')] },
  };
  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === workflowName);
  const payload = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(payload) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return saved.id;
}

const workflowId = await ensureWorkflow();
const secret = await botSecret();
let result;
for (let attempt = 0; attempt < 8; attempt += 1) {
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify({ confirm: 'CHECK_LINKEDIN_POST', post_id: postId }),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  if (response.ok) {
    if (!raw) throw new Error(`empty_webhook_response_status_${response.status}`);
    result = JSON.parse(raw);
    break;
  }
  if (response.status !== 404) throw new Error(`${response.status}: ${raw}`);
  await new Promise((resolve) => setTimeout(resolve, 750));
}
if (!result) throw new Error('webhook_not_ready');
console.log(JSON.stringify({ workflow_id: workflowId, result }, null, 2));
