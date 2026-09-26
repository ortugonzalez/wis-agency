import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const configured = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configured) ? configured : `${configured}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const conductorId = 'AUXgK79OHhhUu2iR';
const expiryId = 'rm5WVrtOIsBsK2Lq';
const writerId = '1ZWaUJr5t3HWFrqa';
const reminderName = 'LinkedIn Bot - Recordatorios aprobación 13:00-18:00';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers, signal: AbortSignal.timeout(30_000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}:${raw}`);
  return raw ? JSON.parse(raw) : {};
}
async function save(workflow) {
  const active = Boolean(workflow.active);
  await api(`/workflows/${workflow.id}`, { method: 'PUT', body: JSON.stringify({
    name: workflow.name, nodes: workflow.nodes, connections: workflow.connections,
    settings: workflow.settings, staticData: workflow.staticData,
  }) });
  let saved = await api(`/workflows/${workflow.id}`);
  if (active && !saved.active) {
    await api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
    saved = await api(`/workflows/${workflow.id}`);
  }
  if (active && !saved.active) throw new Error(`workflow_inactive:${workflow.id}`);
  return saved;
}
function renameNode(workflow, oldName, newName) {
  const node = workflow.nodes.find((candidate) => candidate.name === oldName || candidate.name === newName);
  if (!node) throw new Error(`missing_node:${oldName}`);
  if (node.name === newName) return node;
  node.name = newName;
  if (workflow.connections[oldName]) {
    workflow.connections[newName] = workflow.connections[oldName];
    delete workflow.connections[oldName];
  }
  for (const connection of Object.values(workflow.connections)) {
    for (const outputs of connection.main || []) {
      for (const edge of outputs || []) if (edge.node === oldName) edge.node = newName;
    }
  }
  return node;
}

const conductor = await api(`/workflows/${conductorId}`);
conductor.settings = { ...(conductor.settings || {}), timezone: 'America/Argentina/Buenos_Aires' };
const morning = renameNode(conductor, 'Cron 7:30 ART', 'Cron 8:45 ART (draft 9:00)');
morning.parameters.rule = { interval: [{ field: 'cronExpression', expression: '45 8 * * 1-5' }] };
const timeoutNode = renameNode(conductor, 'Check Timeout 2h', 'Check Timeout 10h');
timeoutNode.parameters.jsCode = String(timeoutNode.parameters.jsCode || '').replace('minutos >= 120', 'minutos >= 600');
const savedConductor = await save(conductor);

const writer = await api(`/workflows/${writerId}`);
const telegramMessage = writer.nodes.find((node) => node.name === 'Build Telegram Message');
if (!telegramMessage) throw new Error('missing_node:Build Telegram Message');
telegramMessage.parameters.jsCode = String(telegramMessage.parameters.jsCode || '')
  .replace('Sin respuesta en 2 horas -> no publico.', 'Si a las 13:00 sigue pendiente, te recuerdo cada 30 minutos. A las 18:30 expira y no se publica.');
const savedWriter = await save(writer);

const expiry = await api(`/workflows/${expiryId}`);
expiry.name = 'LinkedIn Bot - Writer (expire check 18:30 ART)';
expiry.settings = { ...(expiry.settings || {}), timezone: 'America/Argentina/Buenos_Aires' };
const expiryCron = renameNode(expiry, 'Cron 8:45 ART', 'Cron 18:30 ART');
expiryCron.parameters.rule = { interval: [{ field: 'cronExpression', expression: '30 18 * * 1-5' }] };
const savedExpiry = await save(expiry);

const supabaseCredentials = expiry.nodes.find((node) => node.name === 'Get Pendientes Hoy')?.credentials;
const telegramCredentials = expiry.nodes.find((node) => node.name === 'Telegram Aviso Expiro')?.credentials;
if (!supabaseCredentials || !telegramCredentials) throw new Error('missing_reminder_credentials');
const schedule = {
  id: randomUUID(), name: 'Cron cada 30 min 13:00-18:00 ART', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
  position: [0, 0], parameters: { rule: { interval: [
    { field: 'cronExpression', expression: '0,30 13-17 * * 1-5' },
    { field: 'cronExpression', expression: '0 18 * * 1-5' },
  ] } },
};
const getPending = {
  id: randomUUID(), name: 'Get Drafts Pendientes', type: 'n8n-nodes-base.supabase', typeVersion: 1,
  position: [240, 0], credentials: structuredClone(supabaseCredentials), alwaysOutputData: true,
  parameters: { operation: 'getAll', tableId: 'posts_pending', returnAll: true, filterType: 'manual', filters: { conditions: [
    { keyName: 'estado', condition: 'eq', keyValue: 'draft_enviado' },
  ] } },
};
const buildReminder = {
  id: randomUUID(), name: 'Build Recordatorio Pendiente', type: 'n8n-nodes-base.code', typeVersion: 2,
  position: [480, 0], parameters: { jsCode: String.raw`
const pending = $input.all().map((item) => item.json).filter((row) => row?.id && row.estado === 'draft_enviado');
if (!pending.length) return [];
pending.sort((left, right) => new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0));
const latest = pending[0];
const hora = $now.setZone('America/Argentina/Buenos_Aires').toFormat('HH:mm');
const mensaje = '[' + hora + ' ART] Recordatorio: sigue pendiente el borrador de LinkedIn #' + latest.id
  + '. Revisá el mensaje original y respondé OK para publicar, editar: <cambios> para corregirlo o no para descartarlo.';
return [{ json: { mensaje, post_id: latest.id, telegram_msg_id: latest.telegram_msg_id } }];` },
};
const telegram = {
  id: randomUUID(), name: 'Telegram Recordatorio Pendiente', type: 'n8n-nodes-base.telegram', typeVersion: 1.2,
  position: [720, 0], credentials: structuredClone(telegramCredentials),
  parameters: { chatId: '7512675688', text: '={{ $json.mensaje }}', additionalFields: {} },
};
const reminderConnections = {
  [schedule.name]: { main: [[{ node: getPending.name, type: 'main', index: 0 }]] },
  [getPending.name]: { main: [[{ node: buildReminder.name, type: 'main', index: 0 }]] },
  [buildReminder.name]: { main: [[{ node: telegram.name, type: 'main', index: 0 }]] },
};
const workflows = await api('/workflows?limit=100');
const existing = (workflows.data || []).find((workflow) => workflow.name === reminderName);
const payload = { name: reminderName, nodes: [schedule, getPending, buildReminder, telegram], connections: reminderConnections, settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' } };
let reminder = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(payload) });
if (!reminder.active) {
  await api(`/workflows/${reminder.id}/activate`, { method: 'POST', body: '{}' });
  reminder = await api(`/workflows/${reminder.id}`);
}
if (!reminder.active) throw new Error('reminder_workflow_inactive');

const verifyConductor = savedConductor.nodes.find((node) => node.name === 'Cron 8:45 ART (draft 9:00)');
const verifyTimeout = savedConductor.nodes.find((node) => node.name === 'Check Timeout 10h');
const verifyExpiry = savedExpiry.nodes.find((node) => node.name === 'Cron 18:30 ART');
const verifyReminder = reminder.nodes.find((node) => node.name === schedule.name);
if (verifyConductor?.parameters?.rule?.interval?.[0]?.expression !== '45 8 * * 1-5') throw new Error('conductor_schedule_not_persisted');
if (!String(verifyTimeout?.parameters?.jsCode || '').includes('minutos >= 600')) throw new Error('conductor_timeout_not_persisted');
if (verifyExpiry?.parameters?.rule?.interval?.[0]?.expression !== '30 18 * * 1-5') throw new Error('expiry_schedule_not_persisted');
if (!verifyReminder || reminder.settings?.timezone !== 'America/Argentina/Buenos_Aires') throw new Error('reminder_schedule_not_persisted');

console.log(JSON.stringify({
  ok: true,
  timezone: 'America/Argentina/Buenos_Aires',
  weekdays: 'lunes a viernes',
  generation_starts: '08:45',
  draft_expected: 'aprox. 09:00',
  reminders: ['13:00', '13:30', 'cada 30 minutos hasta 18:00'],
  expires: '18:30',
  conductor_active: savedConductor.active,
  writer_active: savedWriter.active,
  reminder_workflow_id: reminder.id,
  reminder_active: reminder.active,
  expiry_active: savedExpiry.active,
}, null, 2));
