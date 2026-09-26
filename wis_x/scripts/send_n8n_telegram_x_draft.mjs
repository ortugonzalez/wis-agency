import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS X - Telegram Draft Review One Shot';
const webhookPath = 'wis-x/telegram-draft-review-one-shot';
const draftText = [
  'Si automatizás algo que está desordenado, el problema no desaparece: avanza más rápido.',
  '',
  'Eso es algo que vemos seguido en WIS. Antes de tocar una herramienta, miramos cómo se trabaja hoy: qué se repite, qué se hace a mano y dónde aparecen las excepciones.',
  '',
  'Primero ordenamos. Después vemos qué vale la pena automatizar.',
].join('\n');
const message = [
  'BORRADOR PARA X',
  '',
  'Formato: publicación única',
  '',
  draftText,
  '',
  `Caracteres: ${draftText.length}/1400`,
  '',
  'Respondé OK para aprobarlo.',
  'EDITAR: <instrucciones>',
  'NO para descartar.',
  '',
  'Si respondés OK, se publicará en X.',
].join('\n');

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-wis-x`, name, type, typeVersion, position, parameters, ...extra };
}

const sharedWorkflow = await api('/workflows/nEzq5nGzYQ663wXM');
const workflowList = await api('/workflows?limit=100');
const dedicatedWorkflow = (workflowList.data || []).find((item) => item.name === 'WIS X - Publisher Telegram Dedicated');
const supabaseTemplate = sharedWorkflow.nodes.find((item) => item.name === 'Get Latest Pending Post');
const telegramTemplate = dedicatedWorkflow?.nodes.find((item) => item.name === 'Telegram X Publicado');
if (!supabaseTemplate?.credentials?.supabaseApi || !telegramTemplate?.credentials?.telegramApi) throw new Error('shared_credentials_not_found');

const nodes = [
  node('Draft Review Webhook', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} }, { webhookId: 'wis-x-telegram-draft-review-one-shot' }),
  node('Crear pendiente X', 'n8n-nodes-base.supabase', 1, [280, 0], { operation: 'create', tableId: 'posts_pending', fieldsUi: { fieldValues: [
    { fieldId: 'noticia_id', fieldValue: '346' },
    { fieldId: 'draft', fieldValue: `[[WIS_X]] ${draftText}` },
    { fieldId: 'version', fieldValue: '1' },
    { fieldId: 'estado', fieldValue: 'draft_enviado' },
  ] } }, { credentials: structuredClone(supabaseTemplate.credentials) }),
  node('Enviar borrador revisado por Telegram', 'n8n-nodes-base.telegram', 1.2, [560, 0], { operation: 'sendMessage', chatId: '7512675688', text: message, additionalFields: {} }, { credentials: structuredClone(telegramTemplate.credentials) }),
  node('Guardar telegram_msg_id X', 'n8n-nodes-base.supabase', 1, [840, 0], { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Crear pendiente X').first().json.id }}" }] }, fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] } }, { credentials: structuredClone(supabaseTemplate.credentials) }),
  node('Responder revisión Telegram', 'n8n-nodes-base.respondToWebhook', 1.4, [1120, 0], { respondWith: 'json', responseBody: '={{ { ok: true, telegram_message_id: String($("Enviar borrador revisado por Telegram").first().json.result.message_id), dry_run: true, pending_saved: true } }}', options: { responseCode: 200 } }),
];

const body = { name: workflowName, nodes, connections: {
  'Draft Review Webhook': { main: [[{ node: 'Crear pendiente X', type: 'main', index: 0 }]] },
  'Crear pendiente X': { main: [[{ node: 'Enviar borrador revisado por Telegram', type: 'main', index: 0 }]] },
  'Enviar borrador revisado por Telegram': { main: [[{ node: 'Guardar telegram_msg_id X', type: 'main', index: 0 }]] },
  'Guardar telegram_msg_id X': { main: [[{ node: 'Responder revisión Telegram', type: 'main', index: 0 }]] },
}, settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' } };

const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === workflowName);
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });

await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
try {
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(90000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`webhook_${response.status}`);
  console.log(JSON.stringify({ ok: true, workflow_id: saved.id, telegram: JSON.parse(raw), dry_run: true }));
} finally {
  await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
}
