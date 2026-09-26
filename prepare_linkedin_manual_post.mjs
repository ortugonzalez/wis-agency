import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const POST_TEXT = `🚀 Mi primera publicación automatizada en LinkedIn

Estamos probando algo que, hasta hace poco, parecía futuro: convertir una idea en contenido, revisarla y publicarla con un flujo asistido por inteligencia artificial.

La IA ya participa en la redacción, edición y distribución de una parte creciente de las noticias que consumimos. Es hora de que esa transformación también alcance al medio digital de las marcas personales.

No se trata de publicar más por publicar. Se trata de transformar ideas en contenido con mayor velocidad, consistencia y criterio, manteniendo siempre a la persona en el centro: la IA propone, la persona revisa y decide.

Este post es una prueba real de ese futuro.

Si estás leyéndolo, el circuito funcionó: idea, redacción, validación humana y publicación.

¿Usarías un sistema así para construir tu presencia digital?`;

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
const workflowName = 'WIS LinkedIn - Preparar publicación manual segura';
const webhookPath = 'wis-linkedin/manual-post';

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

function code(name, position, jsCode) {
  return node(name, 'n8n-nodes-base.code', 2, position, { jsCode });
}

function respond(name, position, status, body = '={{ $json }}') {
  return node(name, 'n8n-nodes-base.respondToWebhook', 1.4, position, {
    respondWith: 'json',
    responseBody: body,
    options: { responseCode: status },
  });
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

function edge(target) {
  return [{ node: target, type: 'main', index: 0 }];
}

function deleteByState(name, position, credential, state) {
  return node(name, 'n8n-nodes-base.supabase', 1, position, {
    operation: 'delete',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'estado', condition: 'eq', keyValue: state }] },
  }, { credentials: structuredClone(credential), alwaysOutputData: true, onError: 'stopWorkflow' });
}

async function extractBotSecret() {
  const list = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar el secreto compartido desde una ejecución segura');
}

async function ensureWorkflow() {
  const writer = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const configTemplate = writer.nodes.find((item) => item.name === 'Get Config');
  const supabaseCredential = writer.nodes.find((item) => item.name === 'Insert posts_pending').credentials;
  const telegramTemplate = writer.nodes.find((item) => item.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredential || !telegramTemplate) throw new Error('Faltan plantillas de credenciales');

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Config Manual';
  getConfig.position = [260, 80];

  const getPending = node('Get Queue', 'n8n-nodes-base.supabase', 1, [1140, 80], {
    operation: 'getAll',
    tableId: 'posts_pending',
    returnAll: true,
  }, { credentials: structuredClone(supabaseCredential), alwaysOutputData: true, onError: 'stopWorkflow' });

  const insertPost = node('Insert Manual Post', 'n8n-nodes-base.supabase', 1, [2900, -80], {
    operation: 'create',
    tableId: 'posts_pending',
    fieldsUi: { fieldValues: [
      { fieldId: 'noticia_id', fieldValue: '173' },
      { fieldId: 'draft', fieldValue: "={{ $('Analyze Queue').first().json.draft }}" },
      { fieldId: 'version', fieldValue: '1' },
      { fieldId: 'estado', fieldValue: 'draft_enviado' },
    ] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const enablePublish = node('Enable Auto Publish', 'n8n-nodes-base.supabase', 1, [3120, -80], {
    operation: 'update',
    tableId: 'config',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'true' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const sendTelegram = structuredClone(telegramTemplate);
  sendTelegram.id = randomUUID();
  sendTelegram.name = 'Send Manual Draft';
  sendTelegram.position = [3560, -80];
  sendTelegram.parameters.text = "={{ $json.telegram_text }}";
  sendTelegram.onError = 'stopWorkflow';

  const sessionAlert = structuredClone(telegramTemplate);
  sessionAlert.id = randomUUID();
  sessionAlert.name = 'Telegram Session Required';
  sessionAlert.position = [2240, 120];
  sessionAlert.parameters.text = '⚠️ PRUEBA DE LINKEDIN PAUSADA\n\nLa sesión de LinkedIn está vencida. Abrí la pantalla segura que dejé visible, iniciá sesión en LinkedIn y avisame por acá.\n\nTodavía no respondas OK: cuando la sesión quede validada te voy a reenviar el post listo para publicar.';
  sessionAlert.onError = 'stopWorkflow';

  const patchTelegram = node('Patch Manual telegram_msg_id', 'n8n-nodes-base.supabase', 1, [3780, -80], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{
      keyName: 'id', condition: 'eq', keyValue: "={{ $('Insert Manual Post').first().json.id }}",
    }] },
    fieldsUi: { fieldValues: [{
      fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}',
    }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const nodes = [
    node('Webhook Manual Post', 'n8n-nodes-base.webhook', 2, [40, 80], {
      httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    code('Validate Manual Request', [480, 80], String.raw`
const rows = $input.all().map((item) => item.json);
const cfg = Object.fromEntries(rows.map((row) => [row.key, row.value]));
const request = $('Webhook Manual Post').first().json;
const body = request.body || {};
const authorized = Boolean(cfg.BOT_SECRET) && String(request.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET);
const action = String(body.action || 'preview');
const draft = String(body.draft || '').trim();
const confirmed = String(body.confirm || '') === 'REPLACE_PENDING_AND_QUEUE';
const valid = action === 'preview' || (action === 'commit' && confirmed && draft.length >= 40);
return [{ json: { authorized, valid, action, commit: action === 'commit', draft } }];`),
    boolIf('IF Authorized', [700, 80], '={{ $json.authorized }}'),
    respond('Respond 401 Manual', [920, 300], 401, "={{ {ok:false,error:'invalid secret'} }}"),
    boolIf('IF Valid Manual', [920, 80], '={{ $json.valid }}'),
    respond('Respond 400 Manual', [1140, 300], 400, "={{ {ok:false,error:'invalid request'} }}"),
    getPending,
    code('Analyze Queue', [1360, 80], String.raw`
const rows = $input.all().map((item) => item.json).filter((row) => row.id);
const request = $('Validate Manual Request').first().json;
const removable = rows.filter((row) => ['draft_enviado','regenerando','aprobado'].includes(String(row.estado)));
return [{ json: {
  commit: request.commit,
  draft: request.draft,
  removable_count: removable.length,
  removable_ids: removable.map((row) => row.id),
  preserved_count: rows.length - removable.length,
} }];`),
    boolIf('IF Commit Manual', [1580, 80], '={{ $json.commit }}'),
    respond('Respond Preview', [1800, 240], 200, "={{ {ok:true,mode:'preview',removable_count:$json.removable_count,removable_ids:$json.removable_ids,preserved_count:$json.preserved_count} }}"),
    node('Check Publisher Session', 'n8n-nodes-base.httpRequest', 4.2, [1800, -80], {
      url: '={{$env.PLAYWRIGHT_SERVICE_URL}}/session',
      options: { response: { response: { responseFormat: 'json', neverError: true } } },
    }, { onError: 'continueRegularOutput' }),
    boolIf('IF Publisher Session Valid', [2020, -80], '={{ $json.ok === true && $json.valid === true }}'),
    sessionAlert,
    respond('Respond Session Required', [2460, 120], 409, "={{ {ok:false,error:'session_expired',message:'Iniciá sesión en LinkedIn antes de habilitar la publicación'} }}"),
    deleteByState('Delete draft_enviado', [2240, -160], supabaseCredential, 'draft_enviado'),
    code('Collapse Delete 1', [2460, -160], "return [{json:{ok:true}}];"),
    deleteByState('Delete regenerando', [2680, -160], supabaseCredential, 'regenerando'),
    code('Collapse Delete 2', [2900, -160], "return [{json:{ok:true}}];"),
    deleteByState('Delete aprobado', [3120, -160], supabaseCredential, 'aprobado'),
    code('Collapse Delete 3', [3340, -160], "return [{json:{ok:true}}];"),
    insertPost,
    enablePublish,
    code('Build Manual Telegram', [3340, -80], String.raw`
const queued = $('Insert Manual Post').first().json;
const context = $('Analyze Queue').first().json;
const telegramText = 'PRUEBA DE PUBLICACIÓN LINKEDIN\n\n' + context.draft + '\n\n—\nHay un único post en cola. Respondé a ESTE mensaje con OK para publicarlo en LinkedIn.\nRespondé no para descartarlo.';
return [{json:{telegram_text:telegramText,post_pending_id:queued.id}}];`),
    sendTelegram,
    patchTelegram,
    respond('Respond Manual Success', [4000, -80], 200, "={{ {ok:true,mode:'queued',removed:$('Analyze Queue').first().json.removable_count,post_pending_id:$('Insert Manual Post').first().json.id,auto_publish:true,telegram_sent:true} }}"),
  ];

  const connections = {
    'Webhook Manual Post': { main: [edge('Get Config Manual')] },
    'Get Config Manual': { main: [edge('Validate Manual Request')] },
    'Validate Manual Request': { main: [edge('IF Authorized')] },
    'IF Authorized': { main: [edge('IF Valid Manual'), edge('Respond 401 Manual')] },
    'IF Valid Manual': { main: [edge('Get Queue'), edge('Respond 400 Manual')] },
    'Get Queue': { main: [edge('Analyze Queue')] },
    'Analyze Queue': { main: [edge('IF Commit Manual')] },
    'IF Commit Manual': { main: [edge('Check Publisher Session'), edge('Respond Preview')] },
    'Check Publisher Session': { main: [edge('IF Publisher Session Valid')] },
    'IF Publisher Session Valid': { main: [edge('Delete draft_enviado'), edge('Telegram Session Required')] },
    'Telegram Session Required': { main: [edge('Respond Session Required')] },
    'Delete draft_enviado': { main: [edge('Collapse Delete 1')] },
    'Collapse Delete 1': { main: [edge('Delete regenerando')] },
    'Delete regenerando': { main: [edge('Collapse Delete 2')] },
    'Collapse Delete 2': { main: [edge('Delete aprobado')] },
    'Delete aprobado': { main: [edge('Collapse Delete 3')] },
    'Collapse Delete 3': { main: [edge('Insert Manual Post')] },
    'Insert Manual Post': { main: [edge('Enable Auto Publish')] },
    'Enable Auto Publish': { main: [edge('Build Manual Telegram')] },
    'Build Manual Telegram': { main: [edge('Send Manual Draft')] },
    'Send Manual Draft': { main: [edge('Patch Manual telegram_msg_id')] },
    'Patch Manual telegram_msg_id': { main: [edge('Respond Manual Success')] },
  };

  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === workflowName);
  const body = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
  const activated = await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return { id: saved.id, active: activated.active };
}

async function invoke(secret, action) {
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify(action === 'commit' ? {
      action,
      confirm: 'REPLACE_PENDING_AND_QUEUE',
      draft: POST_TEXT,
    } : { action: 'preview' }),
    signal: AbortSignal.timeout(90000),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  if (!response.ok && response.status !== 409) throw new Error(`Webhook ${response.status}: ${raw}`);
  return { http_status: response.status, ...data };
}

const action = process.argv[2] || 'preview';
if (!['preview', 'commit'].includes(action)) throw new Error('Usá preview o commit');
const workflow = await ensureWorkflow();
const secret = await extractBotSecret();
const result = await invoke(secret, action);
console.log(JSON.stringify({ ok: true, workflow, action, result }, null, 2));
