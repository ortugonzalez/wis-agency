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

const configuredBase = (env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
if (!configuredBase || !env.N8N_API_KEY) throw new Error('Falta configurar la API de n8n');

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

function addOrReplaceNode(workflow, node) {
  const index = workflow.nodes.findIndex((candidate) => candidate.name === node.name);
  if (index >= 0) workflow.nodes[index] = node;
  else workflow.nodes.push(node);
}

function makeNode(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}

function codeNode(name, position, jsCode) {
  return makeNode(name, 'n8n-nodes-base.code', 2, position, { jsCode });
}

function strictBooleanIf(name, position, leftValue) {
  return makeNode(name, 'n8n-nodes-base.if', 2.2, position, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: randomUUID(),
        leftValue,
        rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  });
}

function responseNode(name, position, responseCode, responseBody = '={{ $json }}') {
  return makeNode(name, 'n8n-nodes-base.respondToWebhook', 1.4, position, {
    respondWith: 'json',
    responseBody,
    options: { responseCode },
  });
}

function supabaseUpdate(name, position, credential, tableId, filterKey, filterValue, fields) {
  return makeNode(name, 'n8n-nodes-base.supabase', 1, position, {
    operation: 'update',
    tableId,
    filterType: 'manual',
    filters: { conditions: [{ keyName: filterKey, condition: 'eq', keyValue: filterValue }] },
    fieldsUi: {
      fieldValues: Object.entries(fields).map(([fieldId, fieldValue]) => ({ fieldId, fieldValue })),
    },
  }, { credentials: structuredClone(credential) });
}

function setEdge(workflow, from, targetsByOutput) {
  workflow.connections[from] = {
    main: targetsByOutput.map((targets) => targets.map((target) => ({ node: target, type: 'main', index: 0 }))),
  };
}

async function save(workflow) {
  const body = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  };
  const saved = await api(`/workflows/${workflow.id}`, { method: 'PUT', body: JSON.stringify(body) });
  const activated = await api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
  return { id: workflow.id, name: saved.name, active: activated.active, nodes: saved.nodes.length };
}

async function hardenWriterRun() {
  const workflow = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const webhook = workflow.nodes.find((node) => node.name === 'Webhook - Writer Run');
  const supabaseCredential = workflow.nodes.find((node) => node.name === 'Insert posts_pending').credentials;
  webhook.parameters.responseMode = 'responseNode';

  workflow.nodes.find((node) => node.name === 'Get Noticia').alwaysOutputData = true;
  workflow.nodes.find((node) => node.name === 'Parse LLM Response').parameters.jsCode = String.raw`
const prev = $('Build Prompt').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('respuesta vacía');
  const cleaned = raw.replace(/\x60\x60\x60json\s*/gi, '').replace(/\x60\x60\x60/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  if (typeof parsed.post !== 'string' || !parsed.post.trim()) throw new Error('campo post ausente');
  return [{ json: { ...parsed, parse_ok: true, run_id: prev.run_id, noticia_id: prev.noticia_id, noticia_titulo: prev.noticia_titulo, noticia_url: prev.noticia_url } }];
} catch (error) {
  return [{ json: { parse_ok: false, ok: false, error: 'llm_invalid_json', detail: error.message, run_id: prev.run_id, noticia_id: prev.noticia_id } }];
}`;

  workflow.nodes.find((node) => node.name === 'Build Telegram Message').parameters.jsCode = String.raw`
const row = Array.isArray($json) ? $json[0] : $json;
const prev = $('Parse LLM Response').first().json;
const autoPublish = $('Parse Config').first().json.AUTO_PUBLISH === 'true';
const fecha = new Date().toLocaleDateString('es-AR');
const okAction = autoPublish ? 'OK -> publico' : 'OK -> apruebo en modo prueba (NO se publica)';
const text = 'Draft LinkedIn — ' + fecha + '\n\n' + prev.post + '\n\n—\nFuente: ' + prev.noticia_titulo + '\n' + prev.noticia_url + '\n\nRespondé:\n' + okAction + '\neditar: <cambios> -> regenero\nno -> descarto\nSin respuesta a las 8:45 -> no publico hoy';
return [{ json: { post_pending_id: row.id, telegram_text: text } }];`;

  addOrReplaceNode(workflow, codeNode('Validar entrada Writer', [920, 120], String.raw`
const body = $('Webhook - Writer Run').first().json.body || {};
const noticiaId = Number(body.noticia_id);
const runId = String(body.run_id || '').trim();
return [{ json: { valid: Number.isInteger(noticiaId) && noticiaId > 0 && Boolean(runId), noticia_id: noticiaId, run_id: runId } }];`));
  addOrReplaceNode(workflow, strictBooleanIf('IF Entrada Writer Valida', [1140, 120], '={{ $json.valid }}'));
  addOrReplaceNode(workflow, responseNode('Respond Writer 400', [1360, 300], 400, "={{ {ok:false,error:'invalid_input'} }}"));
  addOrReplaceNode(workflow, strictBooleanIf('IF Noticia Encontrada', [1580, 120], '={{ Boolean($json.id) }}'));
  addOrReplaceNode(workflow, responseNode('Respond Writer 404', [1800, 300], 404, "={{ {ok:false,error:'noticia_not_found'} }}"));
  addOrReplaceNode(workflow, strictBooleanIf('IF LLM Valido', [2900, 120], '={{ $json.parse_ok }}'));
  addOrReplaceNode(workflow, responseNode('Respond Writer 502', [3120, 300], 502));
  addOrReplaceNode(workflow, supabaseUpdate(
    'Patch telegram_msg_id', [4220, 120], supabaseCredential, 'posts_pending', 'id',
    "={{ $('Build Telegram Message').first().json.post_pending_id }}",
    { telegram_msg_id: '={{ String($json.result.message_id) }}' },
  ));
  addOrReplaceNode(workflow, supabaseUpdate(
    'Marcar noticia procesada', [4440, 120], supabaseCredential, 'noticias_dia', 'id',
    "={{ $('Parse LLM Response').first().json.noticia_id }}",
    { procesada: 'true' },
  ));
  addOrReplaceNode(workflow, responseNode('Respond Writer OK', [4880, 120], 200));
  addOrReplaceNode(workflow, responseNode('Respond Writer 401', [1140, 420], 401));

  setEdge(workflow, 'IF Bot Secret Valido', [['Validar entrada Writer'], ['Build 401 Response']]);
  setEdge(workflow, 'Build 401 Response', [['Respond Writer 401']]);
  setEdge(workflow, 'Validar entrada Writer', [['IF Entrada Writer Valida']]);
  setEdge(workflow, 'IF Entrada Writer Valida', [['Get Noticia'], ['Respond Writer 400']]);
  setEdge(workflow, 'Get Noticia', [['IF Noticia Encontrada']]);
  setEdge(workflow, 'IF Noticia Encontrada', [['Get Few-Shot Corpus'], ['Respond Writer 404']]);
  setEdge(workflow, 'Parse LLM Response', [['IF LLM Valido']]);
  setEdge(workflow, 'IF LLM Valido', [['Insert posts_pending'], ['Respond Writer 502']]);
  setEdge(workflow, 'Enviar Telegram Draft', [['Patch telegram_msg_id']]);
  setEdge(workflow, 'Patch telegram_msg_id', [['Marcar noticia procesada']]);
  setEdge(workflow, 'Marcar noticia procesada', [['Build Response']]);
  setEdge(workflow, 'Build Response', [['Respond Writer OK']]);
  return save(workflow);
}

async function hardenWriterInbound() {
  const workflow = await api('/workflows/nEzq5nGzYQ663wXM');
  const writerRun = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const getConfigTemplate = structuredClone(writerRun.nodes.find((node) => node.name === 'Get Config'));
  const parseConfigTemplate = structuredClone(writerRun.nodes.find((node) => node.name === 'Parse Config'));
  const supabaseCredential = workflow.nodes.find((node) => node.name === 'Patch Nuevo Draft').credentials;
  const telegramCredential = workflow.nodes.find((node) => node.name === 'Telegram Aclaracion').credentials;

  workflow.nodes.find((node) => node.name === 'Extract & Normalize').parameters.jsCode = String.raw`
const msg = $json.message || {};
const text = msg.text || '';
const norm = text.trim().toLowerCase();
const chatId = String(msg.chat?.id || '');
const fromId = String(msg.from?.id || '');
const authorized = chatId === '7512675688' && fromId === '7512675688';
let categoria = 'unknown';
if (['ok','si','sí','dale'].includes(norm)) categoria = 'aprobado';
else if (norm.startsWith('editar:') || norm.startsWith('editar :')) categoria = 'editar';
else if (['no','rechazar'].includes(norm)) categoria = 'rechazado';
const feedback = norm.startsWith('editar') ? text.split(':').slice(1).join(':').trim() : null;
return [{ json: { texto_original: text, categoria, feedback, authorized, reply_to_message_id: msg.reply_to_message?.message_id || null } }];`;

  const latest = workflow.nodes.find((node) => node.name === 'Get Latest Pending Post');
  latest.parameters.returnAll = false;
  latest.parameters.limit = 1;
  workflow.nodes.find((node) => node.name === 'Merge Context').parameters.jsCode = String.raw`
const ctx = $('Extract & Normalize').first().json;
const cfg = $('Parse Config Inbound').first().json;
const post = $json && $json.id ? $json : null;
const replyMatches = !ctx.reply_to_message_id || !post?.telegram_msg_id || String(ctx.reply_to_message_id) === String(post.telegram_msg_id);
return [{ json: { ...ctx, post, reply_matches: replyMatches, auto_publish: cfg.AUTO_PUBLISH === 'true' } }];`;
  workflow.nodes.find((node) => node.name === 'Route').parameters.jsCode = String.raw`
const j = $json;
if (!j.post) return [{ json: { ...j, route: 'noop' } }];
if (!j.reply_matches) return [{ json: { ...j, route: 'unknown' } }];
return [{ json: { ...j, route: j.categoria } }];`;
  workflow.nodes.find((node) => node.name === 'Parse Regen').parameters.jsCode = String.raw`
const prev = $('Build Regenerate Prompt').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('respuesta vacía');
  const cleaned = raw.replace(/\x60\x60\x60json\s*/gi, '').replace(/\x60\x60\x60/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  if (typeof parsed.post !== 'string' || !parsed.post.trim()) throw new Error('campo post ausente');
  return [{ json: { ...parsed, regen_ok: true, post_id: prev.post_id, version_nueva: prev.version_anterior + 1 } }];
} catch (error) {
  return [{ json: { regen_ok: false, post_id: prev.post_id, error: 'regen_invalid_json', detail: error.message } }];
}`;

  getConfigTemplate.id = randomUUID();
  getConfigTemplate.name = 'Get Config Inbound';
  getConfigTemplate.position = [500, 0];
  parseConfigTemplate.id = randomUUID();
  parseConfigTemplate.name = 'Parse Config Inbound';
  parseConfigTemplate.position = [720, 0];
  addOrReplaceNode(workflow, getConfigTemplate);
  addOrReplaceNode(workflow, parseConfigTemplate);
  addOrReplaceNode(workflow, strictBooleanIf('IF Telegram Autorizado', [280, 0], '={{ $json.authorized }}'));
  addOrReplaceNode(workflow, strictBooleanIf('IF Auto Publish', [2100, -220], "={{ $('Parse Config Inbound').first().json.AUTO_PUBLISH === 'true' }}"));
  addOrReplaceNode(workflow, makeNode('Telegram Aprobado Dry Run', 'n8n-nodes-base.telegram', 1.2, [2320, -80], {
    chatId: '7512675688',
    text: 'Aprobado en modo prueba. AUTO_PUBLISH=false: no se publicó nada en LinkedIn.',
    additionalFields: {},
  }, { credentials: structuredClone(telegramCredential) }));
  addOrReplaceNode(workflow, strictBooleanIf('IF Regen Valido', [2100, 120], '={{ $json.regen_ok }}'));
  addOrReplaceNode(workflow, makeNode('Telegram Error Regen', 'n8n-nodes-base.telegram', 1.2, [2320, 260], {
    chatId: '7512675688',
    text: 'No pude regenerar el borrador porque el modelo devolvió un formato inválido. El borrador anterior quedó intacto.',
    additionalFields: {},
  }, { credentials: structuredClone(telegramCredential) }));
  addOrReplaceNode(workflow, supabaseUpdate(
    'Patch telegram_msg_id regen', [2980, 120], supabaseCredential, 'posts_pending', 'id',
    "={{ $('Parse Regen').first().json.post_id }}",
    { telegram_msg_id: '={{ String($json.result.message_id) }}' },
  ));

  setEdge(workflow, 'Extract & Normalize', [['IF Telegram Autorizado']]);
  setEdge(workflow, 'IF Telegram Autorizado', [['Get Config Inbound'], []]);
  setEdge(workflow, 'Get Config Inbound', [['Parse Config Inbound']]);
  setEdge(workflow, 'Parse Config Inbound', [['Get Latest Pending Post']]);
  setEdge(workflow, 'Patch estado=aprobado', [['IF Auto Publish']]);
  setEdge(workflow, 'IF Auto Publish', [['Call Publisher'], ['Telegram Aprobado Dry Run']]);
  setEdge(workflow, 'Parse Regen', [['IF Regen Valido']]);
  setEdge(workflow, 'IF Regen Valido', [['Patch Nuevo Draft'], ['Telegram Error Regen']]);
  setEdge(workflow, 'Telegram Nuevo Draft', [['Patch telegram_msg_id regen']]);
  return save(workflow);
}

async function secureCodexWorkflow(id, webhookName, firstBusinessNode) {
  const workflow = await api(`/workflows/${id}`);
  const writerRun = await api('/workflows/1ZWaUJr5t3HWFrqa');
  const getConfig = structuredClone(writerRun.nodes.find((node) => node.name === 'Get Config'));
  getConfig.id = randomUUID();
  getConfig.name = 'Get Config Seguridad';
  getConfig.position = [220, 80];
  const parseSecurity = codeNode('Validar secreto compartido', [440, 80], String.raw`
const rows = $input.all().map((item) => item.json);
const cfg = Object.fromEntries(rows.map((row) => [row.key, row.value]));
const header = String($('${webhookName}').first().json.headers?.['x-bot-secret'] || '');
return [{ json: { authorized: Boolean(cfg.BOT_SECRET) && header === String(cfg.BOT_SECRET) } }];`);
  const securityIf = strictBooleanIf('IF Secreto Valido', [660, 80], '={{ $json.authorized }}');
  const unauthorized = responseNode('Responder 401', [880, 260], 401, "={{ {ok:false,error:'invalid secret'} }}");
  addOrReplaceNode(workflow, getConfig);
  addOrReplaceNode(workflow, parseSecurity);
  addOrReplaceNode(workflow, securityIf);
  addOrReplaceNode(workflow, unauthorized);
  setEdge(workflow, webhookName, [['Get Config Seguridad']]);
  setEdge(workflow, 'Get Config Seguridad', [['Validar secreto compartido']]);
  setEdge(workflow, 'Validar secreto compartido', [['IF Secreto Valido']]);
  setEdge(workflow, 'IF Secreto Valido', [[firstBusinessNode], ['Responder 401']]);
  return save(workflow);
}

const results = [];
results.push(await hardenWriterRun());
results.push(await hardenWriterInbound());
results.push(await secureCodexWorkflow('nluwzHbQgfHFP0Qr', 'Entrada LinkedIn', 'Leer Contactos LinkedIn'));
results.push(await secureCodexWorkflow('RnlodwUORkQiUsv3', 'Entrada respuesta LinkedIn', 'Leer Contactos inbound'));
console.log(JSON.stringify({ ok: true, results }, null, 2));
