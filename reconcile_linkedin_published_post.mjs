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

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const noTelegram = process.argv.includes('--no-telegram');
const workflowName = noTelegram
  ? 'WIS LinkedIn - Reconciliar publicación verificada sin aviso'
  : 'WIS LinkedIn - Reconciliar publicación verificada';
const webhookPath = noTelegram
  ? 'wis-linkedin/reconcile-published-silent'
  : 'wis-linkedin/reconcile-published';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}

function edge(target) { return [{ node: target, type: 'main', index: 0 }]; }

async function extractBotSecret() {
  const list = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar BOT_SECRET');
}

async function ensureWorkflow() {
  const inbound = await api('/workflows/nEzq5nGzYQ663wXM');
  const writer = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const configTemplate = inbound.nodes.find((item) => item.name === 'Get Config Inbound');
  const supabaseCredential = inbound.nodes.find((item) => item.name === 'Patch Publicado')?.credentials;
  const telegramTemplate = writer.nodes.find((item) => item.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredential || (!noTelegram && !telegramTemplate?.credentials)) throw new Error('Faltan credenciales');

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Reconcile Config';
  getConfig.position = [240, 0];

  const patchPublished = node('Patch Reconciled Publicado', 'n8n-nodes-base.supabase', 1, [900, 0], {
    operation: 'update', tableId: 'posts_pending', filterType: 'manual',
    filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Reconcile').first().json.post_id }}" }] },
    fieldsUi: { fieldValues: [
      { fieldId: 'estado', fieldValue: 'publicado' },
      { fieldId: 'publicado_url', fieldValue: "={{ $('Validate Reconcile').first().json.url }}" },
      { fieldId: 'publicado_at', fieldValue: '={{ new Date().toISOString() }}' },
    ] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const telegram = structuredClone(telegramTemplate);
  telegram.id = randomUUID();
  telegram.name = 'Telegram Reconciled Publicado';
  telegram.position = [1120, 0];
  telegram.parameters.text = "={{ '✅ PUBLICACIÓN CONFIRMADA\\n\\nEl post se publicó correctamente en LinkedIn:\\n' + $('Validate Reconcile').first().json.url }}";
  telegram.onError = 'stopWorkflow';

  const respondReconcile = node('Respond Reconcile', 'n8n-nodes-base.respondToWebhook', 1.4, [1340, 0], {
    respondWith: 'json',
    responseBody: noTelegram
      ? "={{ {ok:true,post_id:$('Validate Reconcile').first().json.post_id,url:$('Validate Reconcile').first().json.url,telegram_skipped:true} }}"
      : "={{ {ok:true,post_id:$('Validate Reconcile').first().json.post_id,url:$('Validate Reconcile').first().json.url,telegram_message_id:$json.result.message_id} }}",
    options: { responseCode: 200 },
  });

  const nodes = [
    node('Webhook Reconcile', 'n8n-nodes-base.webhook', 2, [20, 0], {
      httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    node('Validate Reconcile', 'n8n-nodes-base.code', 2, [460, 0], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Reconcile').first().json;
const post_id = Number(req.body?.post_id || 0);
const url = String(req.body?.url || '');
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'RECONCILE_VERIFIED_LINKEDIN_POST'
  && post_id > 0 && /^https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:activity:\d+\/$/.test(url);
if (!authorized) throw new Error('invalid reconciliation request');
return [{json:{post_id,url}}];` }),
    patchPublished,
    ...(noTelegram ? [] : [telegram]),
    respondReconcile,
  ];
  const connections = {
    'Webhook Reconcile': { main: [edge('Get Reconcile Config')] },
    'Get Reconcile Config': { main: [edge('Validate Reconcile')] },
    'Validate Reconcile': { main: [edge('Patch Reconciled Publicado')] },
    'Patch Reconciled Publicado': { main: [edge(noTelegram ? 'Respond Reconcile' : 'Telegram Reconciled Publicado')] },
    ...(noTelegram ? {} : { 'Telegram Reconciled Publicado': { main: [edge('Respond Reconcile')] } }),
  };

  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === workflowName);
  const body = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  const active = await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return { id: saved.id, active: active.active };
}

async function invoke(secret, postId, url) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body: JSON.stringify({ confirm: 'RECONCILE_VERIFIED_LINKEDIN_POST', post_id: postId, url }),
      signal: AbortSignal.timeout(30000),
    });
    const raw = await response.text();
    if (response.ok) return JSON.parse(raw);
    if (response.status !== 404) throw new Error(`${response.status}: ${raw}`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Webhook reconciliation not registered');
}

const postId = Number(process.argv[2] || 0);
const url = String(process.argv[3] || '');
if (!postId || !url) throw new Error('Uso: node reconcile_linkedin_published_post.mjs POST_ID URL');
const workflow = await ensureWorkflow();
const secret = await extractBotSecret();
const result = await invoke(secret, postId, url);
console.log(JSON.stringify({ workflow, result }, null, 2));
