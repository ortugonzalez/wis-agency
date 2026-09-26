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

const workflowId = 'AUXgK79OHhhUu2iR';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = {
  'X-N8N-API-KEY': env.N8N_API_KEY,
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = raw; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return body;
}

function findNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`missing_node:${name}`);
  return node;
}

const workflow = await api(`/workflows/${workflowId}`);
const wasActive = Boolean(workflow.active);
const callScout = findNode(workflow, 'Call Scout');
const setContext = findNode(workflow, 'Set run_id fecha');
findNode(workflow, 'Log Inicio');

const logConnections = workflow.connections?.['Log Inicio']?.main?.flat() || [];
if (!logConnections.some((connection) => connection.node === 'Call Scout')) {
  throw new Error('unexpected_topology:Log Inicio must feed Call Scout');
}

const header = callScout.parameters?.headerParameters?.parameters
  ?.find((candidate) => String(candidate.name).toLowerCase() === 'x-bot-secret');
if (!header) throw new Error('missing_header:X-Bot-Secret');

header.value = "={{ $('Set run_id fecha').first().json.BOT_SECRET }}";
callScout.parameters.jsonBody = "={{ { run_id: $('Set run_id fecha').first().json.run_id, fecha: $('Set run_id fecha').first().json.fecha } }}";

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
  staticData: workflow.staticData,
};

await api(`/workflows/${workflowId}`, {
  method: 'PUT',
  body: JSON.stringify(body),
});

let saved = await api(`/workflows/${workflowId}`);
if (wasActive && !saved.active) {
  await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
  saved = await api(`/workflows/${workflowId}`);
}

const savedCallScout = findNode(saved, 'Call Scout');
const savedHeader = savedCallScout.parameters.headerParameters.parameters
  .find((candidate) => String(candidate.name).toLowerCase() === 'x-bot-secret');
const expectedHeader = "={{ $('Set run_id fecha').first().json.BOT_SECRET }}";
const expectedBody = "={{ { run_id: $('Set run_id fecha').first().json.run_id, fecha: $('Set run_id fecha').first().json.fecha } }}";

if (savedHeader.value !== expectedHeader || savedCallScout.parameters.jsonBody !== expectedBody) {
  throw new Error('postcondition_failed:Call Scout context was not persisted');
}
if (wasActive && !saved.active) throw new Error('postcondition_failed:workflow was not reactivated');

console.log(JSON.stringify({
  ok: true,
  workflow_id: saved.id,
  workflow_name: saved.name,
  active: saved.active,
  fixed: ['X-Bot-Secret source', 'run_id source', 'fecha source'],
  context_source: setContext.name,
  secret_exposed: false,
}, null, 2));
