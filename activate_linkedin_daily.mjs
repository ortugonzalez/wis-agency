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
const conductorId = 'AUXgK79OHhhUu2iR';
const writerId = '1ZWaUJr5t3HWFrqa';
const keepaliveId = 'UT2tHkciz8i8C1KJ';
const adminName = 'WIS LinkedIn - Activación diaria controlada';
const adminPath = 'wis-linkedin/activate-daily';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

function edge(target) { return [{ node: target, type: 'main', index: 0 }]; }
function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}

async function saveAndActivate(workflow) {
  const body = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  };
  await api(`/workflows/${workflow.id}`, { method: 'PUT', body: JSON.stringify(body) });
  if (workflow.active) await api(`/workflows/${workflow.id}/deactivate`, { method: 'POST', body: '{}' });
  return api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
}

async function extractBotSecret() {
  const list = await api(`/executions?workflowId=${writerId}&limit=10`);
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar BOT_SECRET');
}

async function updateKeepalive() {
  const workflow = await api(`/workflows/${keepaliveId}`);
  const oldName = 'Cada día 10:30 ART';
  const newName = 'Cada día hábil 07:20 ART';
  const schedule = workflow.nodes.find((item) => item.name === oldName || item.name === newName);
  if (!schedule) throw new Error('No se encontró el schedule de sesión');
  schedule.name = newName;
  schedule.parameters.rule.interval[0].expression = '20 7 * * 1-5';
  if (workflow.connections[oldName]) {
    workflow.connections[newName] = workflow.connections[oldName];
    delete workflow.connections[oldName];
  }
  const normalized = JSON.parse(JSON.stringify({ nodes: workflow.nodes, connections: workflow.connections }).replaceAll(oldName, newName));
  workflow.nodes = normalized.nodes;
  workflow.connections = normalized.connections;
  const active = await saveAndActivate(workflow);
  return active.active;
}

async function updateWriter() {
  const workflow = await api(`/workflows/${writerId}`);
  const insert = workflow.nodes.find((item) => item.name === 'Insert posts_pending');
  const build = workflow.nodes.find((item) => item.name === 'Build Telegram Message');
  if (!insert?.credentials || !build) throw new Error('No se encontraron nodos del Writer');

  const enableName = 'Enable Auto Publish For Draft';
  const enable = node(enableName, 'n8n-nodes-base.supabase', 1, [
    (insert.position?.[0] || 0) + 220,
    insert.position?.[1] || 0,
  ], {
    operation: 'update', tableId: 'config', filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'true' }] },
  }, { credentials: structuredClone(insert.credentials), onError: 'stopWorkflow' });
  const existingIndex = workflow.nodes.findIndex((item) => item.name === enableName);
  if (existingIndex >= 0) workflow.nodes[existingIndex] = enable;
  else workflow.nodes.push(enable);

  build.parameters.jsCode = String.raw`
const row = $('Insert posts_pending').first().json;
const prev = $('Parse LLM Response').first().json;
const fecha = new Date().toLocaleDateString('es-AR');
const text = 'INFORME DIARIO + BORRADOR LINKEDIN — ' + fecha + '\n\n' + prev.post
  + '\n\n—\nFuente seleccionada: ' + prev.noticia_titulo + '\n' + prev.noticia_url
  + '\n\nRespondé a ESTE mensaje:\nOK -> publico una sola vez\neditar: <cambios> -> regenero\nno -> descarto\nSin respuesta en 2 horas -> no publico.';
return [{ json: { post_pending_id: row.id, telegram_text: text } }];`;

  workflow.connections['Insert posts_pending'] = { main: [edge(enableName)] };
  workflow.connections[enableName] = { main: [edge('Build Telegram Message')] };
  const active = await saveAndActivate(workflow);
  return active.active;
}

async function ensureAdminWorkflow() {
  const writer = await api(`/workflows/${writerId}`);
  const configTemplate = writer.nodes.find((item) => item.name === 'Get Config');
  const configCredential = writer.nodes.find((item) => item.name === 'Insert posts_pending')?.credentials;
  if (!configTemplate || !configCredential) throw new Error('Faltan credenciales para activación');

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Activation Config';
  getConfig.position = [240, 0];
  const updateConfig = (name, position, key, value) => node(name, 'n8n-nodes-base.supabase', 1, position, {
    operation: 'update', tableId: 'config', filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: key }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: value }] },
  }, { credentials: structuredClone(configCredential), onError: 'stopWorkflow' });

  const nodes = [
    node('Webhook Activate Daily', 'n8n-nodes-base.webhook', 2, [20, 0], {
      httpMethod: 'POST', path: adminPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    node('Validate Activation', 'n8n-nodes-base.code', 2, [460, 0], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Activate Daily').first().json;
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'ACTIVATE_DAILY_WITH_TELEGRAM_APPROVAL';
if (!authorized) throw new Error('invalid activation request');
return [{json:{authorized:true}}];` }),
    updateConfig('Enable SYSTEM_ENABLED', [680, 0], 'SYSTEM_ENABLED', 'true'),
    updateConfig('Reset AUTO_PUBLISH', [900, 0], 'AUTO_PUBLISH', 'false'),
    node('Respond Activation', 'n8n-nodes-base.respondToWebhook', 1.4, [1120, 0], {
      respondWith: 'json',
      responseBody: "={{ {ok:true,system_enabled:true,auto_publish:false} }}",
      options: { responseCode: 200 },
    }),
  ];
  const connections = {
    'Webhook Activate Daily': { main: [edge('Get Activation Config')] },
    'Get Activation Config': { main: [edge('Validate Activation')] },
    'Validate Activation': { main: [edge('Enable SYSTEM_ENABLED')] },
    'Enable SYSTEM_ENABLED': { main: [edge('Reset AUTO_PUBLISH')] },
    'Reset AUTO_PUBLISH': { main: [edge('Respond Activation')] },
  };
  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === adminName);
  const body = { name: adminName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  const active = await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return { id: saved.id, active: active.active };
}

async function invokeAdmin(secret) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/${adminPath}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body: JSON.stringify({ confirm: 'ACTIVATE_DAILY_WITH_TELEGRAM_APPROVAL' }),
      signal: AbortSignal.timeout(30000),
    });
    const raw = await response.text();
    if (response.ok) return JSON.parse(raw);
    if (response.status !== 404) throw new Error(`${response.status}: ${raw}`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('No se registró el webhook de activación');
}

const keepaliveActive = await updateKeepalive();
const writerActive = await updateWriter();
const conductor = await api(`/workflows/${conductorId}`);
if (!conductor.active) await api(`/workflows/${conductorId}/activate`, { method: 'POST', body: '{}' });
const admin = await ensureAdminWorkflow();
const secret = await extractBotSecret();
const config = await invokeAdmin(secret);

console.log(JSON.stringify({
  ok: true,
  keepalive: { active: keepaliveActive, schedule: '20 7 * * 1-5 ART' },
  writer: { active: writerActive, one_shot_publish_per_draft: true },
  conductor: { active: true, schedule: '30 7 * * 1-5 ART' },
  admin,
  config,
}, null, 2));
