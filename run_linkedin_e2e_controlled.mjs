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

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS LinkedIn - E2E controlado (sin publicar)';
const webhookPath = 'wis-linkedin/e2e-controlled';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
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
        id: randomUUID(),
        leftValue: expression,
        rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  });
}

function respond(name, position, responseCode, responseBody) {
  return node(name, 'n8n-nodes-base.respondToWebhook', 1.4, position, {
    respondWith: 'json',
    responseBody,
    options: { responseCode },
  });
}

async function extractBotSecret() {
  const list = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar BOT_SECRET desde una ejecución segura');
}

async function ensureWorkflow() {
  const inbound = await api('/workflows/nEzq5nGzYQ663wXM');
  const writer = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const configTemplate = inbound.nodes.find((item) => item.name === 'Get Config Inbound');
  const supabaseCredential = inbound.nodes.find((item) => item.name === 'Patch estado=aprobado')?.credentials;
  const telegramTemplate = writer.nodes.find((item) => item.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredential || !telegramTemplate?.credentials) {
    throw new Error('No se encontraron las credenciales plantilla necesarias');
  }

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Config E2E';
  getConfig.position = [240, 0];

  const disableAutoPublish = node('Force AUTO_PUBLISH false', 'n8n-nodes-base.supabase', 1, [900, 0], {
    operation: 'update',
    tableId: 'config',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'false' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const insert = node('Insert E2E Queue Row', 'n8n-nodes-base.supabase', 1, [1340, 0], {
    operation: 'create',
    tableId: 'posts_pending',
    fieldsUi: { fieldValues: [
      { fieldId: 'noticia_id', fieldValue: '173' },
      { fieldId: 'draft', fieldValue: "={{ $('Prepare E2E').first().json.draft }}" },
      { fieldId: 'version', fieldValue: "={{ String($('Prepare E2E').first().json.version) }}" },
      { fieldId: 'estado', fieldValue: 'draft_enviado' },
    ] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const sendDraft = structuredClone(telegramTemplate);
  sendDraft.id = randomUUID();
  sendDraft.name = 'Telegram E2E Draft';
  sendDraft.position = [1780, 0];
  sendDraft.parameters.text = "={{ '🧪 TEST INTERNO AUTOMÁTICO — NO RESPONDAS\\n\\nSe creó una cola aislada y ahora Codex simulará el OK. Esto NO puede publicar en LinkedIn.\\n\\nID de prueba: ' + $('Insert E2E Queue Row').first().json.id }}";
  sendDraft.onError = 'stopWorkflow';

  const patchTelegram = node('Patch E2E telegram_msg_id', 'n8n-nodes-base.supabase', 1, [2000, 0], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert E2E Queue Row').first().json.id }}",
    }] },
    fieldsUi: { fieldValues: [{
      fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}',
    }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const approve = node('Patch E2E aprobado', 'n8n-nodes-base.supabase', 1, [2440, 0], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert E2E Queue Row').first().json.id }}",
    }] },
    fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'aprobado' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const callPublisher = node('Call Publisher Test', 'n8n-nodes-base.httpRequest', 4.2, [2660, 0], {
    method: 'POST',
    url: '={{$env.PLAYWRIGHT_SERVICE_URL}}/publish/test',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'content-type', value: 'application/json' },
      { name: 'x-controlled-test', value: 'wis-linkedin-e2e-v1' },
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ { post_id: $('Insert E2E Queue Row').first().json.id, text: $('Prepare E2E').first().json.draft } }}",
    options: { response: { response: { responseFormat: 'json', neverError: true } } },
  }, { onError: 'continueRegularOutput' });

  const patchPublished = node('Patch E2E publicado', 'n8n-nodes-base.supabase', 1, [3320, -100], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert E2E Queue Row').first().json.id }}",
    }] },
    fieldsUi: { fieldValues: [
      { fieldId: 'estado', fieldValue: 'publicado' },
      { fieldId: 'publicado_url', fieldValue: "={{ $('Normalize Publisher Test').first().json.url }}" },
      { fieldId: 'publicado_at', fieldValue: '={{ new Date().toISOString() }}' },
    ] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const sendSuccess = structuredClone(telegramTemplate);
  sendSuccess.id = randomUUID();
  sendSuccess.name = 'Telegram E2E Success';
  sendSuccess.position = [3540, -100];
  sendSuccess.parameters.text = "={{ '✅ TEST INTERNO COMPLETO\\n\\nTelegram, cola, aprobación simulada, publicador seguro y confirmación funcionaron. No se publicó nada en LinkedIn.\\n\\nID de prueba: ' + $('Insert E2E Queue Row').first().json.id }}";
  sendSuccess.onError = 'stopWorkflow';

  const deleteSuccess = node('Delete E2E Success Row', 'n8n-nodes-base.supabase', 1, [3760, -100], {
    operation: 'delete',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert E2E Queue Row').first().json.id }}",
    }] },
  }, { credentials: structuredClone(supabaseCredential), alwaysOutputData: true, onError: 'stopWorkflow' });

  const patchError = node('Patch E2E error', 'n8n-nodes-base.supabase', 1, [3320, 180], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert E2E Queue Row').first().json.id }}",
    }] },
    fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'error' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'continueRegularOutput' });

  const sendError = structuredClone(telegramTemplate);
  sendError.id = randomUUID();
  sendError.name = 'Telegram E2E Error';
  sendError.position = [3540, 180];
  sendError.parameters.text = "={{ '❌ TEST INTERNO FALLÓ\\n\\nNo se publicó nada en LinkedIn. Error: ' + ($('Normalize Publisher Test').first().json.error || 'desconocido') }}";
  sendError.onError = 'continueRegularOutput';

  const deleteError = node('Delete E2E Error Row', 'n8n-nodes-base.supabase', 1, [3760, 180], {
    operation: 'delete',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert E2E Queue Row').first().json.id }}",
    }] },
  }, { credentials: structuredClone(supabaseCredential), alwaysOutputData: true, onError: 'continueRegularOutput' });

  const nodes = [
    node('Webhook E2E', 'n8n-nodes-base.webhook', 2, [20, 0], {
      httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    node('Validate E2E', 'n8n-nodes-base.code', 2, [460, 0], { jsCode: String.raw`
const rows = $input.all().map((item) => item.json);
const cfg = Object.fromEntries(rows.map((row) => [row.key, row.value]));
const req = $('Webhook E2E').first().json;
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET);
const confirmed = String(req.body?.confirm || '') === 'RUN_CONTROLLED_E2E';
return [{json:{authorized:authorized && confirmed}}];` }),
    boolIf('IF E2E Authorized', [680, 0], '={{ $json.authorized }}'),
    respond('Respond E2E 401', [900, 260], 401, "={{ {ok:false,error:'invalid controlled test request'} }}"),
    disableAutoPublish,
    node('Prepare E2E', 'n8n-nodes-base.code', 2, [1120, 0], { jsCode: String.raw`
const now = Date.now();
return [{json:{
  version: 1000000000 + (now % 1000000000),
  draft: '[E2E INTERNO — NO PUBLICAR] Verificación automática del circuito WIS LinkedIn ' + new Date(now).toISOString(),
}}];` }),
    insert,
    node('Build E2E Telegram', 'n8n-nodes-base.code', 2, [1560, 0], { jsCode: "return [{json:{ready:true}}];" }),
    sendDraft,
    patchTelegram,
    node('Simulate OK', 'n8n-nodes-base.code', 2, [2220, 0], { jsCode: String.raw`
return [{json:{approval:'OK',simulated_by:'Codex',approved_at:new Date().toISOString()}}];` }),
    approve,
    callPublisher,
    node('Normalize Publisher Test', 'n8n-nodes-base.code', 2, [2880, 0], { jsCode: String.raw`
const response = $json;
return [{json:{
  ok: response.ok === true && response.test_mode === true && String(response.url || '').startsWith('https://example.invalid/'),
  url: response.url || null,
  error: response.error || response.message || (response.detail ? JSON.stringify(response.detail) : 'publisher test contract failed'),
}}];` }),
    boolIf('IF Publisher Test OK', [3100, 0], '={{ $json.ok }}'),
    patchPublished,
    sendSuccess,
    deleteSuccess,
    respond('Respond E2E Success', [3980, -100], 200, "={{ {ok:true,test_mode:true,linkedin_contacted:false,post_pending_id:$('Insert E2E Queue Row').first().json.id,draft_message_id:$('Telegram E2E Draft').first().json.result.message_id,confirmation_message_id:$('Telegram E2E Success').first().json.result.message_id,mock_url:$('Normalize Publisher Test').first().json.url,queue_cleaned:true} }}"),
    patchError,
    sendError,
    deleteError,
    respond('Respond E2E Failure', [3980, 180], 500, "={{ {ok:false,test_mode:true,linkedin_contacted:false,error:$('Normalize Publisher Test').first().json.error,queue_cleaned:true} }}"),
  ];

  const connections = {
    'Webhook E2E': { main: [edge('Get Config E2E')] },
    'Get Config E2E': { main: [edge('Validate E2E')] },
    'Validate E2E': { main: [edge('IF E2E Authorized')] },
    'IF E2E Authorized': { main: [edge('Force AUTO_PUBLISH false'), edge('Respond E2E 401')] },
    'Force AUTO_PUBLISH false': { main: [edge('Prepare E2E')] },
    'Prepare E2E': { main: [edge('Insert E2E Queue Row')] },
    'Insert E2E Queue Row': { main: [edge('Build E2E Telegram')] },
    'Build E2E Telegram': { main: [edge('Telegram E2E Draft')] },
    'Telegram E2E Draft': { main: [edge('Patch E2E telegram_msg_id')] },
    'Patch E2E telegram_msg_id': { main: [edge('Simulate OK')] },
    'Simulate OK': { main: [edge('Patch E2E aprobado')] },
    'Patch E2E aprobado': { main: [edge('Call Publisher Test')] },
    'Call Publisher Test': { main: [edge('Normalize Publisher Test')] },
    'Normalize Publisher Test': { main: [edge('IF Publisher Test OK')] },
    'IF Publisher Test OK': { main: [edge('Patch E2E publicado'), edge('Patch E2E error')] },
    'Patch E2E publicado': { main: [edge('Telegram E2E Success')] },
    'Telegram E2E Success': { main: [edge('Delete E2E Success Row')] },
    'Delete E2E Success Row': { main: [edge('Respond E2E Success')] },
    'Patch E2E error': { main: [edge('Telegram E2E Error')] },
    'Telegram E2E Error': { main: [edge('Delete E2E Error Row')] },
    'Delete E2E Error Row': { main: [edge('Respond E2E Failure')] },
  };

  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === workflowName);
  const body = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  const activated = await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return { id: saved.id, active: activated.active };
}

async function invoke(secret) {
  let lastError = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body: JSON.stringify({ confirm: 'RUN_CONTROLLED_E2E' }),
      signal: AbortSignal.timeout(90000),
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }
    if (response.ok) return { http_status: response.status, ...data };
    lastError = `${response.status}: ${raw}`;
    if (response.status !== 404) break;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`E2E webhook failed: ${lastError}`);
}

const workflow = await ensureWorkflow();
const secret = await extractBotSecret();
const result = await invoke(secret);
console.log(JSON.stringify({ workflow, result }, null, 2));
