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

const workflowId = 'nEzq5nGzYQ663wXM';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options, headers, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

const workflow = await api(`/workflows/${workflowId}`);
const route = workflow.nodes.find((item) => item.name === 'Route');
const clarification = workflow.nodes.find((item) => item.name === 'Telegram Aclaracion');
if (!route || !clarification) throw new Error('Faltan nodos Route/Telegram Aclaracion');

route.parameters.jsCode = String.raw`
const j = $json;
if (!j.post) return [{ json: { ...j, route: 'unknown', no_pending: true } }];
if (!j.reply_matches) return [{ json: { ...j, route: 'unknown', reply_mismatch: true } }];
return [{ json: { ...j, route: j.categoria } }];`;
clarification.parameters.text = "={{ $json.no_pending ? 'No hay un borrador activo para aprobar: el anterior venció o ya fue procesado. No se publicó nada.' : ($json.reply_mismatch ? 'Ese OK no responde al borrador activo. Respondé directamente al último mensaje recibido.' : 'No entendí la respuesta. Usá OK, editar: <cambios> o no.') }}";

const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings };
await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
if (workflow.active) await api(`/workflows/${workflowId}/deactivate`, { method: 'POST', body: '{}' });
const active = await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });

console.log(JSON.stringify({ ok: true, workflow_id: workflowId, no_pending_notification: true, active: active.active }, null, 2));
