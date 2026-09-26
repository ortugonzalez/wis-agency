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

const inboundWorkflowId = 'nEzq5nGzYQ663wXM';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS LinkedIn - Fixture aprobación inbound';
const setupPath = 'wis-linkedin/inbound-fixture/setup';
const cleanupPath = 'wis-linkedin/inbound-fixture/cleanup';

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

function edge(target) {
  return [{ node: target, type: 'main', index: 0 }];
}

function boolIf(name, position, expression) {
  return node(name, 'n8n-nodes-base.if', 2.2, position, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: randomUUID(), leftValue: expression, rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  });
}

function respond(name, position, code, body) {
  return node(name, 'n8n-nodes-base.respondToWebhook', 1.4, position, {
    respondWith: 'json', responseBody: body, options: { responseCode: code },
  });
}

async function extractBotSecret() {
  const list = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar BOT_SECRET');
}

async function ensureFixtureWorkflow() {
  const inbound = await api(`/workflows/${inboundWorkflowId}`);
  const writer = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const configTemplate = inbound.nodes.find((item) => item.name === 'Get Config Inbound');
  const supabaseCredential = inbound.nodes.find((item) => item.name === 'Patch estado=aprobado')?.credentials;
  const telegramTemplate = writer.nodes.find((item) => item.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredential || !telegramTemplate?.credentials) {
    throw new Error('Faltan plantillas de credenciales');
  }

  const getSetupConfig = structuredClone(configTemplate);
  getSetupConfig.id = randomUUID();
  getSetupConfig.name = 'Get Setup Config';
  getSetupConfig.position = [240, -120];

  const getCleanupConfig = structuredClone(configTemplate);
  getCleanupConfig.id = randomUUID();
  getCleanupConfig.name = 'Get Cleanup Config';
  getCleanupConfig.position = [240, 220];

  const disableAuto = (name, position) => node(name, 'n8n-nodes-base.supabase', 1, position, {
    operation: 'update', tableId: 'config', filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'false' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const insert = node('Insert Inbound Fixture', 'n8n-nodes-base.supabase', 1, [1120, -120], {
    operation: 'create', tableId: 'posts_pending',
    fieldsUi: { fieldValues: [
      { fieldId: 'noticia_id', fieldValue: '173' },
      { fieldId: 'draft', fieldValue: "={{ $('Build Inbound Fixture').first().json.draft }}" },
      { fieldId: 'version', fieldValue: "={{ String($('Build Inbound Fixture').first().json.version) }}" },
      { fieldId: 'estado', fieldValue: 'draft_enviado' },
    ] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const send = structuredClone(telegramTemplate);
  send.id = randomUUID();
  send.name = 'Telegram Inbound Fixture';
  send.position = [1340, -120];
  send.parameters.text = "={{ '🧪 TEST DE APROBACIÓN — NO RESPONDAS\\n\\nCodex enviará internamente un OK vinculado a este mensaje para verificar el workflow real. AUTO_PUBLISH está desactivado.' }}";
  send.onError = 'stopWorkflow';

  const patchMessage = node('Patch Inbound Fixture Message', 'n8n-nodes-base.supabase', 1, [1560, -120], {
    operation: 'update', tableId: 'posts_pending', filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert Inbound Fixture').first().json.id }}",
    }] },
    fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const remove = node('Delete Inbound Fixture', 'n8n-nodes-base.supabase', 1, [1120, 220], {
    operation: 'delete', tableId: 'posts_pending', filterType: 'manual',
    filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Cleanup').first().json.post_id }}" }] },
  }, { credentials: structuredClone(supabaseCredential), alwaysOutputData: true, onError: 'stopWorkflow' });

  const nodes = [
    node('Webhook Fixture Setup', 'n8n-nodes-base.webhook', 2, [20, -120], {
      httpMethod: 'POST', path: setupPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getSetupConfig,
    node('Validate Setup', 'n8n-nodes-base.code', 2, [460, -120], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Fixture Setup').first().json;
const ok = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'SETUP_INBOUND_FIXTURE';
return [{json:{ok}}];` }),
    boolIf('IF Setup Authorized', [680, -120], '={{ $json.ok }}'),
    respond('Respond Setup 401', [900, 40], 401, "={{ {ok:false,error:'unauthorized'} }}"),
    disableAuto('Disable Auto For Inbound Test', [900, -120]),
    node('Build Inbound Fixture', 'n8n-nodes-base.code', 2, [1010, -120], { jsCode: String.raw`
const now = Date.now();
return [{json:{version:1000000000 + (now % 1000000000),draft:'[TEST INBOUND — NO PUBLICAR] ' + new Date(now).toISOString()}}];` }),
    insert,
    send,
    patchMessage,
    respond('Respond Fixture Setup', [1780, -120], 200, "={{ {ok:true,post_id:$('Insert Inbound Fixture').first().json.id,telegram_message_id:$('Telegram Inbound Fixture').first().json.result.message_id} }}"),

    node('Webhook Fixture Cleanup', 'n8n-nodes-base.webhook', 2, [20, 220], {
      httpMethod: 'POST', path: cleanupPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getCleanupConfig,
    node('Validate Cleanup', 'n8n-nodes-base.code', 2, [460, 220], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Fixture Cleanup').first().json;
const post_id = Number(req.body?.post_id || 0);
const ok = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'CLEANUP_INBOUND_FIXTURE' && post_id > 0;
return [{json:{ok,post_id}}];` }),
    boolIf('IF Cleanup Authorized', [680, 220], '={{ $json.ok }}'),
    respond('Respond Cleanup 401', [900, 400], 401, "={{ {ok:false,error:'unauthorized'} }}"),
    remove,
    disableAuto('Restore Auto False', [1340, 220]),
    respond('Respond Fixture Cleanup', [1560, 220], 200, "={{ {ok:true,post_id:$('Validate Cleanup').first().json.post_id,deleted:true,auto_publish:false} }}"),
  ];

  const connections = {
    'Webhook Fixture Setup': { main: [edge('Get Setup Config')] },
    'Get Setup Config': { main: [edge('Validate Setup')] },
    'Validate Setup': { main: [edge('IF Setup Authorized')] },
    'IF Setup Authorized': { main: [edge('Disable Auto For Inbound Test'), edge('Respond Setup 401')] },
    'Disable Auto For Inbound Test': { main: [edge('Build Inbound Fixture')] },
    'Build Inbound Fixture': { main: [edge('Insert Inbound Fixture')] },
    'Insert Inbound Fixture': { main: [edge('Telegram Inbound Fixture')] },
    'Telegram Inbound Fixture': { main: [edge('Patch Inbound Fixture Message')] },
    'Patch Inbound Fixture Message': { main: [edge('Respond Fixture Setup')] },
    'Webhook Fixture Cleanup': { main: [edge('Get Cleanup Config')] },
    'Get Cleanup Config': { main: [edge('Validate Cleanup')] },
    'Validate Cleanup': { main: [edge('IF Cleanup Authorized')] },
    'IF Cleanup Authorized': { main: [edge('Delete Inbound Fixture'), edge('Respond Cleanup 401')] },
    'Delete Inbound Fixture': { main: [edge('Restore Auto False')] },
    'Restore Auto False': { main: [edge('Respond Fixture Cleanup')] },
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

async function postWebhook(path, secret, body, accepted = [200]) {
  let last = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const raw = await response.text();
    if (accepted.includes(response.status)) {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    last = `${response.status}: ${raw}`;
    if (response.status !== 404) break;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`${path} failed: ${last}`);
}

async function waitForInboundExecution(afterIso) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const list = await api(`/executions?workflowId=${inboundWorkflowId}&limit=10`);
    const candidate = (list.data || []).find((row) => row.startedAt >= afterIso);
    if (candidate && candidate.status !== 'running') {
      const execution = await api(`/executions/${candidate.id}?includeData=true`);
      const runData = execution.data?.resultData?.runData || {};
      return { id: candidate.id, status: candidate.status, nodes: Object.keys(runData) };
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Timeout esperando ejecución inbound');
}

const workflow = await ensureFixtureWorkflow();
const secret = await extractBotSecret();
let setup;
try {
  setup = await postWebhook(setupPath, secret, { confirm: 'SETUP_INBOUND_FIXTURE' });
  const started = new Date(Date.now() - 1000).toISOString();
  await postWebhook('wis-linkedin/replay-approval', secret, {
    reply_to_message_id: setup.telegram_message_id,
    message_id: Date.now(),
  });
  const execution = await waitForInboundExecution(started);
  const required = ['Route', 'Patch estado=aprobado', 'IF Auto Publish', 'Telegram Aprobado Dry Run'];
  const missing = required.filter((name) => !execution.nodes.includes(name));
  if (execution.status !== 'success' || missing.length) {
    throw new Error(`Inbound test failed: status=${execution.status}, missing=${missing.join(',')}`);
  }
  console.log(JSON.stringify({
    ok: true,
    workflow,
    post_id: setup.post_id,
    telegram_message_id: setup.telegram_message_id,
    inbound_execution: execution,
    approval_route_verified: true,
    auto_publish: false,
    linkedin_contacted: false,
  }, null, 2));
} finally {
  if (setup?.post_id) {
    await postWebhook(cleanupPath, secret, {
      confirm: 'CLEANUP_INBOUND_FIXTURE', post_id: setup.post_id,
    });
  }
}
