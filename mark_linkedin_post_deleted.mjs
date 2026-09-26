import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
const postId = Number(process.argv[2] || 0);
if (!postId) throw new Error('Uso: node mark_linkedin_post_deleted.mjs POST_ID');
const writerId = '1ZWaUJr5t3HWFrqa';
const inboundId = 'nEzq5nGzYQ663wXM';
const workflowName = 'WIS LinkedIn - Reconciliar publicación eliminada';
const webhookPath = 'wis-linkedin/mark-post-deleted';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${raw}`);
  return raw ? JSON.parse(raw) : {};
}
function makeNode(name, type, typeVersion, position, parameters, extra = {}) { return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra }; }
function edge(node) { return [{ node, type: 'main', index: 0 }]; }
async function botSecret() {
  const list = await api(`/executions?workflowId=${writerId}&limit=10`);
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('missing_bot_secret');
}

async function ensureWorkflow() {
  const inbound = await api(`/workflows/${inboundId}`);
  const writer = await api(`/workflows/${writerId}`);
  const configTemplate = inbound.nodes.find((item) => item.name === 'Get Config Inbound');
  const supabaseCredentials = writer.nodes.find((item) => item.name === 'Insert posts_pending')?.credentials;
  if (!configTemplate || !supabaseCredentials) throw new Error('missing_credentials');
  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID(); getConfig.name = 'Get Delete Config'; getConfig.position = [220, 0];
  const nodes = [
    makeNode('Webhook Mark Deleted', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} }, { webhookId: randomUUID() }),
    getConfig,
    makeNode('Validate Mark Deleted', 'n8n-nodes-base.code', 2, [440, 0], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Mark Deleted').first().json;
const post_id = Number(req.body?.post_id || 0);
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'MARK_LINKEDIN_POST_DELETED' && post_id > 0;
if (!authorized) throw new Error('unauthorized');
return [{ json: { post_id } }];` }),
    makeNode('Patch Post Deleted', 'n8n-nodes-base.supabase', 1, [660, 0], {
      operation: 'update', tableId: 'posts_pending', filterType: 'manual',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Mark Deleted').first().json.post_id }}" }] },
      fieldsUi: { fieldValues: [
        { fieldId: 'estado', fieldValue: 'eliminado' },
        { fieldId: 'feedback_ortu', fieldValue: 'Eliminado manualmente de LinkedIn por falta de cita y contexto.' },
      ] },
    }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' }),
    makeNode('Respond Mark Deleted', 'n8n-nodes-base.respondToWebhook', 1.4, [880, 0], {
      respondWith: 'json', responseBody: '={{ {ok:true,post_id:$json.id,estado:$json.estado,publicado_url:$json.publicado_url} }}', options: { responseCode: 200 },
    }),
  ];
  const connections = {
    'Webhook Mark Deleted': { main: [edge('Get Delete Config')] },
    'Get Delete Config': { main: [edge('Validate Mark Deleted')] },
    'Validate Mark Deleted': { main: [edge('Patch Post Deleted')] },
    'Patch Post Deleted': { main: [edge('Respond Mark Deleted')] },
  };
  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === workflowName);
  const payload = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) }) : await api('/workflows', { method: 'POST', body: JSON.stringify(payload) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return saved.id;
}

const workflowId = await ensureWorkflow();
const secret = await botSecret();
let result;
for (let attempt = 0; attempt < 8; attempt += 1) {
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify({ confirm: 'MARK_LINKEDIN_POST_DELETED', post_id: postId }), signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  if (response.ok) { result = JSON.parse(raw); break; }
  if (response.status !== 404) throw new Error(`${response.status}: ${raw}`);
  await new Promise((resolve) => setTimeout(resolve, 750));
}
if (!result) throw new Error('webhook_not_ready');
console.log(JSON.stringify({ ok: true, workflow_id: workflowId, result }, null, 2));
