import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const SOURCE_URL = 'https://www.orgvue.com/news/new-research-exposes-the-complexity-of-deploying-ai-systemsin-the-workforce/';
const DRAFT = `Despidieron gente para ahorrar con IA. Uno de cada tres tuvo que volver a contratarla.

El dato no sale de una opinión: Orgvue y Watermelon Research encuestaron a 300 responsables de RR.HH. de Estados Unidos. Entre las organizaciones que hicieron recortes esperando ahorrar con IA, el 32% terminó recontratando. Y el 23% admitió que había decidido basándose en supuestos generales, no en un análisis de tareas y roles.

Para mí, ese es el punto: automatizar no empieza preguntando cuánta gente sobra. Empieza entendiendo qué trabajo existe, qué parte se repite y qué parte necesita criterio humano.

Esto no prueba que la IA no funcione. Sí muestra cuánto puede costar implementar una promesa antes de entender el proceso.

En tu empresa, ¿primero están midiendo qué tarea mejora o ya están calculando qué puesto reemplazar?

Fuente: Orgvue / Watermelon Research — encuesta a 300 responsables de RR.HH. de EE.UU., publicada el 12/03/2026. ${SOURCE_URL}`;

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
if (!postId) throw new Error('Uso: node replace_pending_draft_secure.mjs POST_ID');
const draftBody = DRAFT.replace(/\n+Fuente:[\s\S]*$/i, '').trim();
if (draftBody.length < 600 || draftBody.length > 950 || DRAFT.length > 3000) throw new Error(`draft_length:${DRAFT.length}`);

const writerId = '1ZWaUJr5t3HWFrqa';
const inboundId = 'nEzq5nGzYQ663wXM';
const workflowName = 'WIS LinkedIn - Reemplazo seguro de borrador';
const webhookPath = 'wis-linkedin/replace-pending-secure';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${raw}`);
  return raw ? JSON.parse(raw) : {};
}
function makeNode(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}
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
  const supabaseCredentials = inbound.nodes.find((item) => item.name === 'Patch Nuevo Draft')?.credentials;
  const telegramTemplate = writer.nodes.find((item) => item.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredentials || !telegramTemplate?.credentials) throw new Error('missing_credentials');

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID(); getConfig.name = 'Get Replace Config'; getConfig.position = [220, 0];
  const telegram = structuredClone(telegramTemplate);
  telegram.id = randomUUID(); telegram.name = 'Send Reviewed Draft'; telegram.position = [900, 0];
  telegram.parameters.text = "={{ 'BORRADOR REVISADO — APLICABLE A EMPRESAS\\n\\n' + $('Validate Replace').first().json.draft + '\\n\\nRespondé a ESTE mensaje:\\nOK -> publico una sola vez\\neditar: <cambios> -> ajusto\\nno -> descarto' }}";

  const nodes = [
    makeNode('Webhook Replace', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} }, { webhookId: randomUUID() }),
    getConfig,
    makeNode('Validate Replace', 'n8n-nodes-base.code', 2, [440, 0], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Replace').first().json;
const body = req.body || {};
const post_id = Number(body.post_id || 0);
const noticia_id = Number(body.noticia_id || 0);
const draft = String(body.draft || '').trim();
const source_url = String(body.source_url || '').trim();
const draft_body = draft.replace(/\n+Fuente:[\s\S]*$/i, '').trim();
const authorized = Boolean(cfg.BOT_SECRET)
  && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(body.confirm || '') === 'REPLACE_PENDING_DRAFT'
  && post_id > 0 && noticia_id > 0 && draft_body.length >= 600 && draft_body.length <= 950 && draft.length <= 3000
  && !/<[^>]+>/i.test(draft) && /^https:\/\//i.test(source_url)
  && (draft.match(/https?:\/\/[^\s]+/g) || []).length === 1
  && draft.includes(source_url) && /(^|\n)Fuente:/i.test(draft);
if (!authorized) throw new Error('invalid_replacement');
return [{ json: { post_id, noticia_id, draft, source_url } }];` }),
    makeNode('Patch Reviewed Draft', 'n8n-nodes-base.supabase', 1, [660, 0], {
      operation: 'update', tableId: 'posts_pending', filterType: 'manual',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Replace').first().json.post_id }}" }] },
      fieldsUi: { fieldValues: [
        { fieldId: 'noticia_id', fieldValue: "={{ $('Validate Replace').first().json.noticia_id }}" },
        { fieldId: 'draft', fieldValue: "={{ $('Validate Replace').first().json.draft }}" },
        { fieldId: 'version', fieldValue: '2' },
        { fieldId: 'estado', fieldValue: 'draft_enviado' },
      ] },
    }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' }),
    makeNode('Enable One Shot Publish', 'n8n-nodes-base.supabase', 1, [780, 0], {
      operation: 'update', tableId: 'config', filterType: 'manual',
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
      fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'true' }] },
    }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' }),
    telegram,
    makeNode('Patch Reviewed Message', 'n8n-nodes-base.supabase', 1, [1120, 0], {
      operation: 'update', tableId: 'posts_pending', filterType: 'manual',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Replace').first().json.post_id }}" }] },
      fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] },
    }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' }),
    makeNode('Respond Replace', 'n8n-nodes-base.respondToWebhook', 1.4, [1340, 0], {
      respondWith: 'json', responseBody: "={{ {ok:true,post_id:$('Validate Replace').first().json.post_id,noticia_id:$('Validate Replace').first().json.noticia_id,characters:$('Validate Replace').first().json.draft.length,telegram_message_id:$json.telegram_msg_id,published:false} }}", options: { responseCode: 200 },
    }),
  ];
  const connections = {
    'Webhook Replace': { main: [edge('Get Replace Config')] },
    'Get Replace Config': { main: [edge('Validate Replace')] },
    'Validate Replace': { main: [edge('Patch Reviewed Draft')] },
    'Patch Reviewed Draft': { main: [edge('Enable One Shot Publish')] },
    'Enable One Shot Publish': { main: [edge('Send Reviewed Draft')] },
    'Send Reviewed Draft': { main: [edge('Patch Reviewed Message')] },
    'Patch Reviewed Message': { main: [edge('Respond Replace')] },
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
if (process.argv.includes('--ensure-only')) {
  console.log(JSON.stringify({ ok: true, workflow_id: workflowId, updated: true, invoked: false }, null, 2));
  process.exit(0);
}
const secret = await botSecret();
let result;
for (let attempt = 0; attempt < 8; attempt += 1) {
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify({
      confirm: 'REPLACE_PENDING_DRAFT', post_id: postId, noticia_id: 1, draft: DRAFT,
      source_url: SOURCE_URL,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  if (response.ok) { result = JSON.parse(raw); break; }
  if (response.status !== 404) throw new Error(`${response.status}: ${raw}`);
  await new Promise((resolve) => setTimeout(resolve, 750));
}
if (!result) throw new Error('webhook_not_ready');
console.log(JSON.stringify({ ok: true, workflow_id: workflowId, result, draft: DRAFT }, null, 2));
