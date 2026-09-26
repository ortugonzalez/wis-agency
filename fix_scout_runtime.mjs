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

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowId = 'um0levNI0wM7FROb';

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
const fetchNode = workflow.nodes.find((node) => node.name === 'Code - Fetch & Parse Fuentes');
const attachNode = workflow.nodes.find((node) => node.name === 'Code - Attach ID');
const logsNode = workflow.nodes.find((node) => node.name === 'Supabase - Insertar run_logs');
const respondNode = workflow.nodes.find((node) => node.name === 'Respond to Webhook');
const candidateInsert = workflow.nodes.find((node) => node.name === 'Supabase - Insert candidata');
const selectedUpdate = workflow.nodes.find((node) => node.name === 'Supabase - Marcar seleccionada');

if (!fetchNode || !attachNode || !logsNode || !respondNode || !candidateInsert || !selectedUpdate) {
  throw new Error('No se encontraron todos los nodos Scout requeridos');
}

fetchNode.parameters.jsCode = fetchNode.parameters.jsCode
  .replace(
    "const runId = $('Webhook').first().json.body.run_id;\nconst fecha = $('Webhook').first().json.body.fecha;",
    "const body = $('Webhook').first().json.body || {};\nconst runId = String(body.run_id || ('scout-' + Date.now()));\nconst fecha = String(body.fecha || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()));",
  );

attachNode.parameters.jsCode = "const prior = $('Code - Parse score').item.json;\nif ($json.error || !$json.id) throw new Error('No se pudo insertar candidata: ' + String($json.error || 'ID ausente'));\nreturn { json: { ...prior, id: $json.id } };";

for (const field of logsNode.parameters.fieldsUi.fieldValues) {
  field.fieldValue = `={{ $json.${field.fieldId} }}`;
}

respondNode.parameters.responseBody = "={{ $('Code - Build Response').first().json.ok ? { ok: true, noticia_id: $('Code - Build Response').first().json.mejor.id, score: $('Code - Build Response').first().json.mejor.score, titulo: $('Code - Build Response').first().json.mejor.titulo, url: $('Code - Build Response').first().json.mejor.url } : { ok: false, error: $('Code - Build Response').first().json.error || 'no candidatas relevantes hoy' } }}";
candidateInsert.onError = 'stopWorkflow';
selectedUpdate.onError = 'stopWorkflow';
logsNode.onError = 'stopWorkflow';

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
};
const saved = await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
const activated = await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
console.log(JSON.stringify({ ok: true, id: saved.id, name: saved.name, active: activated.active, nodes: saved.nodes.length }, null, 2));
