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

const workflowId = process.argv[2];
const requestedNames = new Set(process.argv.slice(3));
if (!workflowId) throw new Error('Uso: node inspect_n8n_nodes.mjs WORKFLOW_ID ["Nodo 1" ...]');

const configuredBase = (env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const response = await fetch(`${apiRoot}/workflows/${workflowId}`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
const workflow = await response.json();

const nodes = workflow.nodes
  .filter((node) => requestedNames.size === 0 || requestedNames.has(node.name))
  .map((node) => ({
    name: node.name,
    type: node.type,
    typeVersion: node.typeVersion,
    webhookId: node.webhookId,
    disabled: node.disabled,
    parameters: requestedNames.size === 0 ? undefined : node.parameters,
    credentials: Object.fromEntries(Object.entries(node.credentials || {}).map(([type, ref]) => [type, ref.name])),
  }));

console.log(JSON.stringify({ workflowId, name: workflow.name, active: workflow.active, nodes }, null, 2));
