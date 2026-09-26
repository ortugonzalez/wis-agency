import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }));
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const api = async (path, options = {}) => { const r = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } if (!r.ok) throw new Error(`n8n_${r.status}_${path}`); return j; };
const base = await api('/workflows/VT1s1aTNn4y9BZo0');
const credentials = structuredClone(base.nodes.find((node) => node.name === 'Get Latest X Pending Post').credentials);
const name = 'WIS X - Reject Superseded Voice Draft One Shot';
const nodes = [
  { id: 'reject-trigger', name: 'Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], parameters: { httpMethod: 'POST', path: 'wis-x/reject-superseded-voice-draft', responseMode: 'lastNode', options: {} }, webhookId: 'wis-x-reject-superseded-voice-draft' },
  { id: 'reject-patch', name: 'Reject superseded', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [240, 0], parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '41' }] }, fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'rechazado' }, { fieldId: 'feedback_ortu', fieldValue: 'Prueba técnica reemplazada: no publicar.' }] } }, credentials },
];
const body = { name, nodes, connections: { Trigger: { main: [[{ node: 'Reject superseded', type: 'main', index: 0 }]] } }, settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' } };
const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === name);
const saved = existing ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) }) : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
const response = await fetch(`${publicBase}/webhook/wis-x/reject-superseded-voice-draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
console.log(JSON.stringify({ workflow_id: saved.id, status: response.status, body: await response.text() }));
await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
