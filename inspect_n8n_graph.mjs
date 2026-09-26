import fs from 'node:fs';
const workflowId = process.argv[2];
if (!workflowId) throw new Error('Uso: node inspect_n8n_graph.mjs WORKFLOW_ID');
const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const root = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
const response = await fetch(`${root}/workflows/${workflowId}`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY }, signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`n8n_${response.status}`);
const workflow = await response.json();
console.log(JSON.stringify({
  id: workflow.id, name: workflow.name, active: workflow.active,
  settings: workflow.settings,
  nodes: workflow.nodes.map((node) => ({ name: node.name, type: node.type, disabled: Boolean(node.disabled) })),
  connections: workflow.connections,
}, null, 2));
