import fs from 'node:fs';

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

const workflowId = 'nEzq5nGzYQ663wXM';
// Usar un nombre sin espacios evita que Telegram y n8n difieran entre la ruta
// codificada con %20 y la misma ruta decodificada.
const oldName = 'Telegram Trigger - Respuestas Ortu';
const newName = 'TelegramInbound';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

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
const trigger = workflow.nodes.find((node) => node.name === oldName || node.name === newName);
if (!trigger) throw new Error('No se encontró el trigger Telegram');
trigger.name = newName;

if (workflow.connections[oldName]) {
  workflow.connections[newName] = workflow.connections[oldName];
  delete workflow.connections[oldName];
}

const serialized = JSON.stringify({ nodes: workflow.nodes, connections: workflow.connections })
  .replaceAll(oldName, newName);
const normalized = JSON.parse(serialized);
const body = {
  name: workflow.name,
  nodes: normalized.nodes,
  connections: normalized.connections,
  settings: workflow.settings,
};

await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
await api(`/workflows/${workflowId}/deactivate`, { method: 'POST', body: '{}' });
const active = await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
console.log(JSON.stringify({ ok: true, id: workflowId, trigger: newName, active: active.active }, null, 2));
