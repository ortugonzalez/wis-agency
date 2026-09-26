import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}:${JSON.stringify(json).slice(0, 500)}`);
  return json;
}

const workflows = JSON.parse(fs.readFileSync(new URL('../workflows/wis-x-export.json', import.meta.url), 'utf8'));
const existing = await api('/workflows?limit=100');
const results = [];
for (const workflow of workflows) {
  const current = (existing.data || []).find((item) => item.name === workflow.name);
  const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings };
  const saved = current
    ? await api(`/workflows/${current.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  results.push({ id: saved.id, name: saved.name, active: false });
}
console.log(JSON.stringify({ ok: true, installed: results.length, workflows: results }, null, 2));
