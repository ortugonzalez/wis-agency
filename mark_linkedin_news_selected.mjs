import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const noticiaId = Number(process.argv[2] || 0);
const selectedValue = String(process.argv[3] || 'true').toLowerCase() === 'true';
if (!noticiaId) throw new Error('Uso: node mark_linkedin_news_selected.mjs NOTICIA_ID');
const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const configured = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configured) ? configured : `${configured}/api/v1`;
const publicBase = configured.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers, signal: AbortSignal.timeout(30_000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}:${raw}`);
  return raw ? JSON.parse(raw) : {};
}
const scout = await api('/workflows/um0levNI0wM7FROb');
const credential = scout.nodes.find((node) => node.name === 'Supabase - Marcar seleccionada')?.credentials;
if (!credential) throw new Error('missing_supabase_credential');
const name = 'WIS LinkedIn - Marcar noticia seleccionada';
const path = 'wis-linkedin/mark-news-selected';
const invocationToken = randomUUID();
const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((row) => row.name === name);
const nodes = [
  { id: randomUUID(), name: 'Webhook Mark', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: randomUUID(), parameters: { httpMethod: 'POST', path, responseMode: 'responseNode', options: {} } },
  { id: randomUUID(), name: 'Validate Mark', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0], parameters: { jsCode: `const body = $json.body || {};\nconst authorized = String($json.headers?.['x-mark-token'] || '') === ${JSON.stringify(invocationToken)} && Number(body.noticia_id || 0) > 0 && body.confirm === 'MARK_SELECTED';\nif (!authorized) throw new Error('unauthorized');\nreturn [{json:{noticia_id:Number(body.noticia_id)}}];` } },
  { id: randomUUID(), name: 'Patch Selected', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [440, 0], credentials: structuredClone(credential), parameters: { operation: 'update', tableId: 'noticias_dia', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Mark').first().json.noticia_id }}" }] }, fieldsUi: { fieldValues: [{ fieldId: 'seleccionada', fieldValue: selectedValue ? 'true' : 'false' }] } } },
  { id: randomUUID(), name: 'Respond Mark', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: [660, 0], parameters: { respondWith: 'json', responseBody: "={{ {ok:true,noticia_id:$json.id,seleccionada:$json.seleccionada} }}", options: { responseCode: 200 } } },
];
const connections = {
  'Webhook Mark': { main: [[{ node: 'Validate Mark', type: 'main', index: 0 }]] },
  'Validate Mark': { main: [[{ node: 'Patch Selected', type: 'main', index: 0 }]] },
  'Patch Selected': { main: [[{ node: 'Respond Mark', type: 'main', index: 0 }]] },
};
const payload = { name, nodes, connections, settings: { executionOrder: 'v1' } };
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(payload) });
if (!saved.active) await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
const response = await fetch(`${publicBase}/webhook/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mark-Token': invocationToken },
  body: JSON.stringify({ confirm: 'MARK_SELECTED', noticia_id: noticiaId }), signal: AbortSignal.timeout(30_000),
});
const raw = await response.text();
if (!response.ok) throw new Error(`mark_failed_${response.status}:${raw}`);
console.log(JSON.stringify({ workflow_id: saved.id, requested_selected: selectedValue, ...(JSON.parse(raw)) }, null, 2));
