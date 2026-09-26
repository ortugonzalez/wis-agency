import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }));
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const api = async (path, options = {}) => { const r = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } if (!r.ok) throw new Error(`n8n_${r.status}_${path}`); return j; };
const baseWorkflow = await api('/workflows/VT1s1aTNn4y9BZo0');
const credentials = structuredClone(baseWorkflow.nodes.find((node) => node.name === 'Get Latest X Pending Post').credentials);
const name = 'WIS X - Inspect noticias_dia Schema One Shot';
const nodes = [
  { id: 'inspect-trigger', name: 'Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], parameters: { httpMethod: 'POST', path: 'wis-x/inspect-news-schema', responseMode: 'responseNode', options: {} }, webhookId: 'wis-x-inspect-news-schema' },
  { id: 'inspect-get', name: 'Get news', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [240, 0], parameters: { operation: 'getAll', tableId: 'noticias_dia', returnAll: false, limit: 1 }, credentials },
  { id: 'inspect-code', name: 'Shape', type: 'n8n-nodes-base.code', typeVersion: 2, position: [480, 0], parameters: { jsCode: "const row = $input.first()?.json || {}; return [{json:{keys:Object.keys(row), sample:Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value === 'string' ? value.slice(0,80) : value]))}}];" } },
  { id: 'inspect-response', name: 'Response', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: [720, 0], parameters: { respondWith: 'json', responseBody: '={{$json}}', options: {} } },
];
const body = { name, nodes, connections: { Trigger: { main: [[{ node: 'Get news', type: 'main', index: 0 }]] }, 'Get news': { main: [[{ node: 'Shape', type: 'main', index: 0 }]] }, Shape: { main: [[{ node: 'Response', type: 'main', index: 0 }]] } }, settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' } };
const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === name);
const saved = existing ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) }) : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
const response = await fetch(`${publicBase}/webhook/wis-x/inspect-news-schema`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
console.log(JSON.stringify({ workflow_id: saved.id, status: response.status, body: await response.text() }));
await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
