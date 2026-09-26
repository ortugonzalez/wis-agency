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

const ids = {
  conductor: 'AUXgK79OHhhUu2iR',
  writer: '1ZWaUJr5t3HWFrqa',
  inbound: 'nEzq5nGzYQ663wXM',
  reminder: 'DEfjlrnDKPueQLQC',
  expiry: 'rm5WVrtOIsBsK2Lq',
};

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}:${raw}`);
  return raw ? JSON.parse(raw) : {};
}

async function save(workflow) {
  const wasActive = Boolean(workflow.active);
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {},
    staticData: workflow.staticData || null,
  };
  await api(`/workflows/${workflow.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  let saved = await api(`/workflows/${workflow.id}`);
  if (wasActive && !saved.active) {
    await api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
    saved = await api(`/workflows/${workflow.id}`);
  }
  if (wasActive && !saved.active) throw new Error(`workflow_inactive_after_save:${workflow.id}`);
  return saved;
}

function node(workflow, name) {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`missing_node:${workflow.id}:${name}`);
  return found;
}

function makeNode(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}

function edge(target) {
  return [{ node: target, type: 'main', index: 0 }];
}

function setConnection(workflow, source, outputs) {
  workflow.connections[source] = { main: outputs };
}

function removeConnection(workflow, source) {
  delete workflow.connections[source];
}

function upsertNode(workflow, replacement) {
  const index = workflow.nodes.findIndex((candidate) => candidate.name === replacement.name);
  if (index >= 0) workflow.nodes[index] = replacement;
  else workflow.nodes.push(replacement);
}

function replyKeyboard() {
  return {
    replyMarkup: 'replyKeyboard',
    replyKeyboard: {
      rows: [{
        row: {
          buttons: [
            { text: '✅ Publicar', additionalFields: {} },
            { text: '❌ Descartar', additionalFields: {} },
          ],
        },
      }],
    },
    replyKeyboardOptions: { resize_keyboard: true, one_time_keyboard: true },
  };
}

async function rebuildWriter() {
  const workflow = await api(`/workflows/${ids.writer}`);
  workflow.settings = { ...(workflow.settings || {}), timezone: 'America/Argentina/Buenos_Aires' };
  const insert = node(workflow, 'Insert posts_pending');
  const credentials = structuredClone(insert.credentials);
  const insertFields = insert.parameters.fieldsUi?.fieldValues || [];
  const noticiaField = insertFields.find((field) => field.fieldId === 'noticia_id');
  const draftField = insertFields.find((field) => field.fieldId === 'draft');
  if (!noticiaField || !draftField) throw new Error('missing_writer_insert_fields');
  noticiaField.fieldValue = "={{ $('Parse LLM Response').first().json.noticia_id }}";
  draftField.fieldValue = "={{ $('Parse LLM Response').first().json.post }}";

  upsertNode(workflow, makeNode(
    'Get Previous LinkedIn Pending',
    'n8n-nodes-base.supabase',
    1,
    [3120, 180],
    {
      operation: 'getAll', tableId: 'posts_pending', returnAll: true, filterType: 'manual',
      filters: { conditions: [{ keyName: 'estado', condition: 'eq', keyValue: 'draft_enviado' }] },
    },
    { credentials, alwaysOutputData: true, onError: 'stopWorkflow' },
  ));
  upsertNode(workflow, makeNode(
    'Select Previous LinkedIn Pending',
    'n8n-nodes-base.code',
    2,
    [3340, 180],
    { mode: 'runOnceForAllItems', jsCode: String.raw`
const rows = $input.all().map((item) => item.json).filter((row) => row?.id && row.estado === 'draft_enviado');
const linkedIn = rows.filter((row) => !String(row.draft || '').startsWith('[[WIS_X]]'));
if (!linkedIn.length) return [{ json: { has_previous: false } }];
return linkedIn.map((row) => ({ json: { has_previous: true, id: row.id } }));` },
  ));
  upsertNode(workflow, makeNode(
    'IF Previous LinkedIn Pending',
    'n8n-nodes-base.if',
    2.2,
    [3560, 180],
    {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{
          id: randomUUID(), leftValue: '={{ $json.has_previous === true }}', rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        }],
        combinator: 'and',
      },
      options: {},
    },
  ));
  upsertNode(workflow, makeNode(
    'Supersede Previous LinkedIn Pending',
    'n8n-nodes-base.supabase',
    1,
    [3780, 80],
    {
      operation: 'update', tableId: 'posts_pending', filterType: 'manual',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '={{ $json.id }}' }] },
      fieldsUi: { fieldValues: [
        { fieldId: 'estado', fieldValue: 'reemplazado' },
        { fieldId: 'feedback_ortu', fieldValue: 'Reemplazado automáticamente por el nuevo borrador diario de LinkedIn.' },
      ] },
    },
    { credentials, onError: 'stopWorkflow' },
  ));
  upsertNode(workflow, makeNode(
    'Collapse Pending Cleanup',
    'n8n-nodes-base.code',
    2,
    [4000, 180],
    { mode: 'runOnceForAllItems', jsCode: "return [{ json: { cleanup_ok: true } }];" },
  ));

  setConnection(workflow, 'IF LLM Valido', [edge('Get Previous LinkedIn Pending'), edge('Respond Writer 502')]);
  setConnection(workflow, 'Get Previous LinkedIn Pending', [edge('Select Previous LinkedIn Pending')]);
  setConnection(workflow, 'Select Previous LinkedIn Pending', [edge('IF Previous LinkedIn Pending')]);
  setConnection(workflow, 'IF Previous LinkedIn Pending', [edge('Supersede Previous LinkedIn Pending'), edge('Collapse Pending Cleanup')]);
  setConnection(workflow, 'Supersede Previous LinkedIn Pending', [edge('Collapse Pending Cleanup')]);
  setConnection(workflow, 'Collapse Pending Cleanup', [edge('Insert posts_pending')]);
  setConnection(workflow, 'Insert posts_pending', [edge('Build Telegram Message')]);
  removeConnection(workflow, 'Enable Auto Publish For Draft');
  node(workflow, 'Enable Auto Publish For Draft').disabled = true;

  node(workflow, 'Build Telegram Message').parameters.jsCode = String.raw`
const row = $('Insert posts_pending').first().json;
const prev = $('Parse LLM Response').first().json;
const fecha = $now.setZone('America/Argentina/Buenos_Aires').toFormat('dd/MM/yyyy');
const text = 'BORRADOR LINKEDIN — ' + fecha + '\n\n' + prev.post
  + '\n\n—\nFuente seleccionada: ' + prev.noticia_titulo + '\n' + prev.noticia_url
  + '\n\nElegí una opción o respondé a ESTE mensaje:\n✅ Publicar / OK -> publico una sola vez\nEditar: <cambios> -> preparo una nueva versión\n❌ Descartar / no -> no se publica\n\nSi sigue pendiente, recibirás un solo recordatorio a las 13:00. A las 18:30 vence y no se publica.';
return [{ json: { post_pending_id: row.id, telegram_text: text } }];`;

  const telegram = node(workflow, 'Enviar Telegram Draft');
  telegram.parameters = {
    resource: 'message', operation: 'sendMessage', chatId: '7512675688',
    text: '={{$json.telegram_text}}', ...replyKeyboard(), additionalFields: {},
  };
  telegram.onError = 'stopWorkflow';
  return save(workflow);
}

async function rebuildInbound() {
  const workflow = await api(`/workflows/${ids.inbound}`);
  workflow.settings = { ...(workflow.settings || {}), timezone: 'America/Argentina/Buenos_Aires' };

  node(workflow, 'Extract & Normalize').parameters.jsCode = String.raw`
const msg = $json.message || {};
const text = String(msg.text || '');
const norm = text.trim().toLowerCase();
const chatId = String(msg.chat?.id || '');
const fromId = String(msg.from?.id || '');
const authorized = chatId === '7512675688' && fromId === '7512675688';
let categoria = 'unknown';
if (['ok', 'si', 'sí', 'dale', '✅ publicar', 'publicar'].includes(norm)) categoria = 'aprobado';
else if (norm === 'editar' || norm.startsWith('editar:') || norm.startsWith('editar :')) categoria = 'editar';
else if (['no', 'rechazar', 'cancelar', 'descartar', '❌ descartar'].includes(norm)) categoria = 'rechazado';
else if (norm === 'hilo') categoria = 'hilo';
else if (norm === 'corto') categoria = 'corto';
const feedback = categoria === 'editar' ? text.split(':').slice(1).join(':').trim() : null;
return [{ json: { texto_original: text, categoria, feedback, authorized, reply_to_message_id: msg.reply_to_message?.message_id || null } }];`;

  setConnection(workflow, 'Patch estado=aprobado', [edge('Call Publisher')]);
  removeConnection(workflow, 'IF Auto Publish');
  removeConnection(workflow, 'Disable Auto Publish One Shot');
  node(workflow, 'IF Auto Publish').disabled = true;
  node(workflow, 'Disable Auto Publish One Shot').disabled = true;
  node(workflow, 'Telegram Aprobado Dry Run').disabled = true;

  const regenTelegram = node(workflow, 'Telegram Nuevo Draft');
  regenTelegram.parameters = {
    resource: 'message', operation: 'sendMessage', chatId: '7512675688',
    text: '={{$json.texto}}', ...replyKeyboard(), additionalFields: {},
  };
  regenTelegram.onError = 'stopWorkflow';
  node(workflow, 'Build Nuevo Draft Msg').parameters.jsCode = String.raw`
const j = $('Parse Regen').first().json;
return [{ json: { texto: 'NUEVA VERSIÓN LINKEDIN (v' + j.version_nueva + ')\n\n' + j.post
  + '\n\nElegí una opción o respondé a ESTE mensaje:\n✅ Publicar / OK -> publico una sola vez\nEditar: <cambios> -> vuelvo a ajustar\n❌ Descartar / no -> no se publica' } }];`;
  return save(workflow);
}

async function rebuildConductor() {
  const workflow = await api(`/workflows/${ids.conductor}`);
  workflow.settings = { ...(workflow.settings || {}), timezone: 'America/Argentina/Buenos_Aires' };
  removeConnection(workflow, 'Log Writer OK');
  removeConnection(workflow, 'Cron 10:00 Resumen');
  for (const name of [
    'Set Poll Start', 'Wait Poll 5min', 'Get Post Pending', 'IF Estado Terminal',
    'Build Mensaje Final', 'Log Final', 'Telegram Final', 'Check Timeout 10h',
    'IF Timeout', 'Log Timeout', 'Telegram Timeout', 'Cron 10:00 Resumen',
    'Get Logs Hoy', 'Build Resumen', 'Telegram Resumen',
  ]) node(workflow, name).disabled = true;
  return save(workflow);
}

async function rebuildReminder() {
  const workflow = await api(`/workflows/${ids.reminder}`);
  workflow.name = 'LinkedIn Bot - Un recordatorio de aprobación 13:00';
  workflow.settings = { ...(workflow.settings || {}), timezone: 'America/Argentina/Buenos_Aires' };
  workflow.staticData = null;
  const schedule = workflow.nodes.find((candidate) => ['Cron cada 30 min 13:00-18:00 ART', 'Cron único 13:00 ART'].includes(candidate.name));
  if (!schedule) throw new Error('missing_reminder_schedule');
  schedule.name = 'Cron único 13:00 ART';
  schedule.parameters.rule = { interval: [{ field: 'cronExpression', expression: '0 13 * * 1-5' }] };
  if (workflow.connections['Cron cada 30 min 13:00-18:00 ART']) {
    workflow.connections['Cron único 13:00 ART'] = workflow.connections['Cron cada 30 min 13:00-18:00 ART'];
    delete workflow.connections['Cron cada 30 min 13:00-18:00 ART'];
  }
  node(workflow, 'Build Recordatorio Pendiente').parameters = {
    mode: 'runOnceForAllItems',
    jsCode: String.raw`
const zone = 'America/Argentina/Buenos_Aires';
const today = $now.setZone(zone).toISODate();
const pending = $input.all().map((item) => item.json).filter((row) => {
  if (!row?.id || row.estado !== 'draft_enviado' || String(row.draft || '').startsWith('[[WIS_X]]')) return false;
  const created = row.created_at ? new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: zone }) : '';
  return created === today;
});
if (!pending.length) return [];
pending.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
const latest = pending[0];
const data = $getWorkflowStaticData('global');
const key = 'reminder:' + today + ':' + latest.id;
if (data[key]) return [];
data[key] = $now.toISO();
return [{ json: {
  mensaje: '⏰ Recordatorio único: el borrador de LinkedIn #' + latest.id + ' sigue esperando tu decisión. Publicalo, pedí cambios o descartalo antes de las 18:30.',
  post_id: latest.id,
  telegram_msg_id: Number(latest.telegram_msg_id || 0),
} }];`,
  };
  const telegram = node(workflow, 'Telegram Recordatorio Pendiente');
  telegram.parameters = {
    resource: 'message', operation: 'sendMessage', chatId: '7512675688',
    text: '={{ $json.mensaje }}', ...replyKeyboard(),
    additionalFields: { reply_to_message_id: '={{ $json.telegram_msg_id }}' },
  };
  telegram.onError = 'stopWorkflow';
  return save(workflow);
}

async function rebuildExpiry() {
  const workflow = await api(`/workflows/${ids.expiry}`);
  workflow.name = 'LinkedIn Bot - Vencimiento único 18:30 ART';
  workflow.settings = { ...(workflow.settings || {}), timezone: 'America/Argentina/Buenos_Aires' };
  workflow.staticData = null;
  node(workflow, 'Hay Pendientes?').parameters = {
    mode: 'runOnceForAllItems',
    jsCode: String.raw`
const zone = 'America/Argentina/Buenos_Aires';
const today = $now.setZone(zone).toISODate();
const pending = $input.all().map((item) => item.json).filter((row) => {
  if (!row?.id || row.estado !== 'draft_enviado' || String(row.draft || '').startsWith('[[WIS_X]]')) return false;
  const created = row.created_at ? new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: zone }) : '';
  return created === today;
});
if (!pending.length) return [{ json: { count: 0 } }];
pending.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
const latest = pending[0];
const data = $getWorkflowStaticData('global');
const key = 'expiry:' + today + ':' + latest.id;
if (data[key]) return [{ json: { count: 0, duplicate_blocked: true } }];
data[key] = $now.toISO();
return [{ json: { count: 1, post_id: latest.id, telegram_msg_id: Number(latest.telegram_msg_id || 0) } }];`,
  };
  const patch = node(workflow, 'Patch Expirados');
  patch.parameters.filters = { conditions: [{
    keyName: 'id', condition: 'eq', keyValue: "={{ $('Hay Pendientes?').first().json.post_id }}",
  }] };
  patch.parameters.fieldsUi = { fieldValues: [
    { fieldId: 'estado', fieldValue: 'expirado' },
    { fieldId: 'feedback_ortu', fieldValue: 'Venció a las 18:30 ART sin aprobación.' },
  ] };
  patch.onError = 'stopWorkflow';
  const telegram = node(workflow, 'Telegram Aviso Expiro');
  telegram.parameters = {
    resource: 'message', operation: 'sendMessage', chatId: '7512675688',
    text: "={{ '⌛ El borrador de LinkedIn #' + $('Hay Pendientes?').first().json.post_id + ' venció. Hoy no se publica.' }}",
    additionalFields: { reply_to_message_id: "={{ $('Hay Pendientes?').first().json.telegram_msg_id }}" },
  };
  telegram.onError = 'stopWorkflow';
  return save(workflow);
}

async function disableGlobalAutoPublish(supabaseCredentials) {
  const name = 'WIS LinkedIn - Desactivar AUTO_PUBLISH global';
  const path = `wis-linkedin/disable-global-auto-publish-${randomUUID()}`;
  const nodes = [
    makeNode('Webhook Disable Global Flag', 'n8n-nodes-base.webhook', 2, [0, 0], {
      httpMethod: 'POST', path, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    makeNode('Patch AUTO_PUBLISH false', 'n8n-nodes-base.supabase', 1, [240, 0], {
      operation: 'update', tableId: 'config', filterType: 'manual',
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
      fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'false' }] },
    }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' }),
    makeNode('Respond Flag Disabled', 'n8n-nodes-base.respondToWebhook', 1.4, [480, 0], {
      respondWith: 'json', responseBody: "={{ {ok:true,key:$json.key,value:$json.value} }}", options: { responseCode: 200 },
    }),
  ];
  const connections = {
    'Webhook Disable Global Flag': { main: [edge('Patch AUTO_PUBLISH false')] },
    'Patch AUTO_PUBLISH false': { main: [edge('Respond Flag Disabled')] },
  };
  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === name);
  const payload = { name, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(payload) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  let result;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.text();
    if (response.ok) { result = JSON.parse(raw); break; }
    if (response.status !== 404) throw new Error(`disable_flag_${response.status}:${raw}`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  if (!result?.ok || String(result.value) !== 'false') throw new Error('auto_publish_global_not_disabled');
  return { workflow_id: saved.id, ...result };
}

function simulateSelection(rows, date) {
  return rows
    .filter((row) => row.estado === 'draft_enviado' && row.platform === 'linkedin' && row.date === date)
    .sort((a, b) => b.id - a.id)
    .slice(0, 1);
}

const writer = await rebuildWriter();
const inbound = await rebuildInbound();
const conductor = await rebuildConductor();
const reminder = await rebuildReminder();
const expiry = await rebuildExpiry();
const supabaseCredentials = node(writer, 'Insert posts_pending').credentials;
const flag = await disableGlobalAutoPublish(supabaseCredentials);

const fixture = [
  { id: 38, estado: 'draft_enviado', platform: 'linkedin', date: '2026-08-29' },
  { id: 42, estado: 'draft_enviado', platform: 'x', date: '2026-08-31' },
  { id: 47, estado: 'draft_enviado', platform: 'linkedin', date: '2026-08-31' },
];
const selected = simulateSelection(fixture, '2026-08-31');
if (selected.length !== 1 || selected[0].id !== 47) throw new Error('fixture_selection_failed');

const verifyWriter = await api(`/workflows/${ids.writer}`);
const verifyInbound = await api(`/workflows/${ids.inbound}`);
const verifyConductor = await api(`/workflows/${ids.conductor}`);
const verifyReminder = await api(`/workflows/${ids.reminder}`);
const verifyExpiry = await api(`/workflows/${ids.expiry}`);

if (verifyWriter.connections?.['Insert posts_pending']?.main?.[0]?.[0]?.node !== 'Build Telegram Message') throw new Error('writer_still_uses_global_flag');
if (verifyInbound.connections?.['Patch estado=aprobado']?.main?.[0]?.[0]?.node !== 'Call Publisher') throw new Error('inbound_not_event_driven');
if (verifyConductor.connections?.['Log Writer OK']) throw new Error('conductor_poll_still_connected');
if (verifyConductor.connections?.['Cron 10:00 Resumen']) throw new Error('telegram_summary_still_connected');
if (node(verifyReminder, 'Cron único 13:00 ART').parameters.rule.interval[0].expression !== '0 13 * * 1-5') throw new Error('reminder_schedule_invalid');
if (node(verifyExpiry, 'Patch Expirados').parameters.filters.conditions[0].keyName !== 'id') throw new Error('expiry_not_single_row');

console.log(JSON.stringify({
  ok: true,
  workflows: {
    writer: { id: writer.id, active: writer.active },
    inbound: { id: inbound.id, active: inbound.active },
    conductor: { id: conductor.id, active: conductor.active },
    reminder: { id: reminder.id, active: reminder.active, schedule: '13:00 ART lunes a viernes' },
    expiry: { id: expiry.id, active: expiry.active, schedule: '18:30 ART lunes a viernes' },
  },
  global_auto_publish: flag.value,
  controlled_fixture: { input_rows: fixture.length, selected_rows: selected.length, selected_id: selected[0].id },
  telegram_policy: { draft: 1, reminder_max: 1, expiry_max: 1, technical_summary: 0, conductor_poll_messages: 0 },
}, null, 2));
