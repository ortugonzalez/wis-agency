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
const workflowName = 'WIS X - Telegram Test One Shot';
const webhookPath = 'wis-x/telegram-test-one-shot';
const message = [
  'BORRADOR PARA X — PRUEBA CONTROLADA (CORRECCIÓN)',
  '',
  'Las empresas no necesitan otra herramienta de IA: necesitan que la atención no dependa de que alguien se acuerde de responder. Un flujo bien diseñado convierte consultas en seguimiento, ventas y menos trabajo manual. ¿Qué parte de tu proceso todavía depende de memoria?',
  '',
  'Caracteres ponderados: 269',
  'Formato: publicación única',
  'Esta prueba es DRY-RUN: todavía no publica en X.',
  'Respondé OK sólo para verificar el circuito de aprobación.',
].join('\n');

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-wis-x`, name, type, typeVersion, position, parameters, ...extra };
}

const nodes = [
  node('WIS X Telegram Test Webhook', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} }, { webhookId: 'wis-x-telegram-test-one-shot' }),
  node('Enviar borrador de prueba por Telegram', 'n8n-nodes-base.telegram', 1.2, [280, 0], { operation: 'sendMessage', chatId: '7512675688', text: message, additionalFields: {} }, { credentials: { telegramApi: { id: env.N8N_TELEGRAM_CREDENTIAL_ID, name: env.N8N_TELEGRAM_CREDENTIAL_NAME || 'Telegram account' } } }),
  node('Responder prueba Telegram', 'n8n-nodes-base.respondToWebhook', 1.4, [560, 0], { respondWith: 'json', responseBody: "={{ {ok:true,telegram_message_id:$json.result.message_id,dry_run:true} }}", options: { responseCode: 200 } }),
];

const body = { name: workflowName, nodes, connections: {
  'WIS X Telegram Test Webhook': { main: [[{ node: 'Enviar borrador de prueba por Telegram', type: 'main', index: 0 }]] },
  'Enviar borrador de prueba por Telegram': { main: [[{ node: 'Responder prueba Telegram', type: 'main', index: 0 }]] },
}, settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' } };

const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === workflowName);
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });

let response;
try {
  response = await fetch(`${publicBase}/webhook/${webhookPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(90000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`webhook_${response.status}`);
  console.log(JSON.stringify({ ok: true, workflow_id: saved.id, workflow_name: workflowName, webhook_path: webhookPath, response: JSON.parse(raw), dry_run: true }));
} finally {
  await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
}
