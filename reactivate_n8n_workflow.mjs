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
if (!workflowId) throw new Error('Falta workflow id');
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${raw}`);
  return JSON.parse(raw);
}

const deactivated = await api(`/workflows/${workflowId}/deactivate`);
const activated = await api(`/workflows/${workflowId}/activate`);
console.log(JSON.stringify({
  ok: true,
  id: workflowId,
  deactivated: deactivated.active === false,
  active: activated.active === true,
}, null, 2));
