import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const targets = [
  ['1ZWaUJr5t3HWFrqa', 'Build Prompt'],
  ['nEzq5nGzYQ663wXM', 'Build Regenerate Prompt'],
];

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options, headers, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

const results = [];
for (const [workflowId, nodeName] of targets) {
  const workflow = await api(`/workflows/${workflowId}`);
  const prompt = workflow.nodes.find((item) => item.name === nodeName);
  if (!prompt) throw new Error(`No se encontró ${nodeName}`);
  prompt.parameters.jsCode = prompt.parameters.jsCode.replace(/,\\n\]\.join/g, ',\n].join');
  new Function(prompt.parameters.jsCode);
  const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings };
  await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
  if (workflow.active) await api(`/workflows/${workflowId}/deactivate`, { method: 'POST', body: '{}' });
  const active = await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
  results.push({ workflow_id: workflowId, node: nodeName, syntax_ok: true, active: active.active });
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
