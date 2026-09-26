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
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowId = 'nEzq5nGzYQ663wXM';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

const workflow = await api(`/workflows/${workflowId}`);
const credential = workflow.nodes.find((item) => item.name === 'Get Config Inbound')?.credentials;
if (!credential) throw new Error('No se encontró la credencial Supabase');

const disableNode = {
  id: randomUUID(),
  name: 'Disable Auto Publish One Shot',
  type: 'n8n-nodes-base.supabase',
  typeVersion: 1,
  position: [2320, -300],
  parameters: {
    operation: 'update',
    tableId: 'config',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'false' }] },
  },
  credentials: structuredClone(credential),
  onError: 'stopWorkflow',
};

const index = workflow.nodes.findIndex((item) => item.name === disableNode.name);
if (index >= 0) workflow.nodes[index] = disableNode;
else workflow.nodes.push(disableNode);

workflow.connections['IF Auto Publish'] = {
  main: [
    [{ node: 'Disable Auto Publish One Shot', type: 'main', index: 0 }],
    [{ node: 'Telegram Aprobado Dry Run', type: 'main', index: 0 }],
  ],
};
workflow.connections['Disable Auto Publish One Shot'] = {
  main: [[{ node: 'Call Publisher', type: 'main', index: 0 }]],
};

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
};
const saved = await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
const active = await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
console.log(JSON.stringify({ ok: true, id: saved.id, active: active.active, one_shot: true }, null, 2));
