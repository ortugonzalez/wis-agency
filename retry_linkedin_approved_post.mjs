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
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS LinkedIn - Reintento seguro de post aprobado';
const webhookPath = 'wis-linkedin/retry-approved-post';

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

async function ensureWorkflow() {
  const inbound = await api('/workflows/nEzq5nGzYQ663wXM');
  const writer = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const configTemplate = inbound.nodes.find((item) => item.name === 'Get Config Inbound');
  const supabaseCredential = inbound.nodes.find((item) => item.name === 'Patch estado=aprobado')?.credentials;
  const telegramTemplate = writer.nodes.find((item) => item.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredential || !telegramTemplate?.credentials) {
    throw new Error('Faltan plantillas de credenciales');
  }

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Retry Config';
  getConfig.position = [240, 0];

  const getPost = node('Get Approved Post', 'n8n-nodes-base.supabase', 1, [900, 0], {
    operation: 'getAll', tableId: 'posts_pending', returnAll: false,
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Retry').first().json.post_id }}",
    }] },
    limit: 1,
  }, { credentials: structuredClone(supabaseCredential), alwaysOutputData: true, onError: 'stopWorkflow' });

  const callPublisher = node('Retry Publisher', 'n8n-nodes-base.httpRequest', 4.2, [1340, 0], {
    method: 'POST', url: '={{$env.PLAYWRIGHT_SERVICE_URL}}/publish',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'content-type', value: 'application/json' }] },
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ { post_id: $('Validate Post').first().json.post.id, text: $('Validate Post').first().json.post.draft } }}",
    options: { response: { response: { responseFormat: 'json', neverError: true } } },
  }, { onError: 'continueRegularOutput' });

  const patchPublished = node('Patch Retry Publicado', 'n8n-nodes-base.supabase', 1, [2000, -100], {
    operation: 'update', tableId: 'posts_pending', filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Post').first().json.post.id }}",
    }] },
    fieldsUi: { fieldValues: [
      { fieldId: 'estado', fieldValue: 'publicado' },
      { fieldId: 'publicado_url', fieldValue: "={{ $('Normalize Retry Result').first().json.url }}" },
      { fieldId: 'publicado_at', fieldValue: '={{ new Date().toISOString() }}' },
    ] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const successTelegram = structuredClone(telegramTemplate);
  successTelegram.id = randomUUID();
  successTelegram.name = 'Telegram Retry Publicado';
  successTelegram.position = [2220, -100];
  successTelegram.parameters.text = "={{ '✅ Publicado correctamente: ' + $('Normalize Retry Result').first().json.url }}";
  successTelegram.onError = 'stopWorkflow';

  const patchError = node('Patch Retry Error', 'n8n-nodes-base.supabase', 1, [2000, 180], {
    operation: 'update', tableId: 'posts_pending', filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Post').first().json.post.id }}",
    }] },
    fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'error' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'continueRegularOutput' });

  const errorTelegram = structuredClone(telegramTemplate);
  errorTelegram.id = randomUUID();
  errorTelegram.name = 'Telegram Retry Error';
  errorTelegram.position = [2220, 180];
  errorTelegram.parameters.text = "={{ '❌ El reintento seguro no publicó nada. Error: ' + ($('Normalize Retry Result').first().json.error || 'desconocido') }}";
  errorTelegram.onError = 'continueRegularOutput';

  const nodes = [
    node('Webhook Retry Approved', 'n8n-nodes-base.webhook', 2, [20, 0], {
      httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    node('Validate Retry', 'n8n-nodes-base.code', 2, [460, 0], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Retry Approved').first().json;
const post_id = Number(req.body?.post_id || 0);
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'RETRY_ALREADY_APPROVED_POST' && post_id > 0;
return [{json:{authorized,post_id}}];` }),
    boolIf('IF Retry Authorized', [680, 0], '={{ $json.authorized }}'),
    respond('Respond Retry 401', [900, 300], 401, "={{ {ok:false,error:'unauthorized'} }}"),
    getPost,
    node('Validate Post', 'n8n-nodes-base.code', 2, [1120, 0], { jsCode: String.raw`
const post = $json?.id ? $json : null;
const valid = Boolean(post) && ['error','aprobado'].includes(String(post.estado)) && String(post.draft || '').length >= 40;
return [{json:{valid,post}}];` }),
    boolIf('IF Post Retryable', [1230, 0], '={{ $json.valid }}'),
    respond('Respond Post Invalid', [1450, 300], 409, "={{ {ok:false,error:'post_not_retryable'} }}"),
    callPublisher,
    node('Normalize Retry Result', 'n8n-nodes-base.code', 2, [1560, 0], { jsCode: String.raw`
const response = $json;
const ok = response.ok === true && Boolean(response.url);
return [{json:{ok,url:response.url || null,error:ok ? null : (response.error || response.detail || 'publisher_failed')}}];` }),
    boolIf('IF Retry Published', [1780, 0], '={{ $json.ok }}'),
    patchPublished,
    successTelegram,
    respond('Respond Retry Success', [2440, -100], 200, "={{ {ok:true,post_id:$('Validate Post').first().json.post.id,url:$('Normalize Retry Result').first().json.url,telegram_message_id:$('Telegram Retry Publicado').first().json.result.message_id} }}"),
    patchError,
    errorTelegram,
    respond('Respond Retry Failure', [2440, 180], 502, "={{ {ok:false,post_id:$('Validate Post').first().json.post.id,error:$('Normalize Retry Result').first().json.error,telegram_message_id:$('Telegram Retry Error').first().json.result.message_id} }}"),
  ];

  const connections = {
    'Webhook Retry Approved': { main: [edge('Get Retry Config')] },
    'Get Retry Config': { main: [edge('Validate Retry')] },
    'Validate Retry': { main: [edge('IF Retry Authorized')] },
    'IF Retry Authorized': { main: [edge('Get Approved Post'), edge('Respond Retry 401')] },
    'Get Approved Post': { main: [edge('Validate Post')] },
    'Validate Post': { main: [edge('IF Post Retryable')] },
    'IF Post Retryable': { main: [edge('Retry Publisher'), edge('Respond Post Invalid')] },
    'Retry Publisher': { main: [edge('Normalize Retry Result')] },
    'Normalize Retry Result': { main: [edge('IF Retry Published')] },
    'IF Retry Published': { main: [edge('Patch Retry Publicado'), edge('Patch Retry Error')] },
    'Patch Retry Publicado': { main: [edge('Telegram Retry Publicado')] },
    'Telegram Retry Publicado': { main: [edge('Respond Retry Success')] },
    'Patch Retry Error': { main: [edge('Telegram Retry Error')] },
    'Telegram Retry Error': { main: [edge('Respond Retry Failure')] },
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

async function invoke(secret, postId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body: JSON.stringify({ confirm: 'RETRY_ALREADY_APPROVED_POST', post_id: postId }),
      signal: AbortSignal.timeout(180000),
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }
    if (response.ok) return { http_status: response.status, ...data };
    if (response.status !== 404) throw new Error(`Retry ${response.status}: ${raw}`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('El webhook de reintento no quedó registrado');
}

const postId = Number(process.argv[2] || 0);
if (!postId) throw new Error('Uso: node retry_linkedin_approved_post.mjs POST_ID');
const workflow = await ensureWorkflow();
if (process.argv.includes('--ensure-only')) {
  console.log(JSON.stringify({ workflow, updated: true, invoked: false }, null, 2));
  process.exit(0);
}
const secret = await extractBotSecret();
const result = await invoke(secret, postId);
console.log(JSON.stringify({ workflow, result }, null, 2));
