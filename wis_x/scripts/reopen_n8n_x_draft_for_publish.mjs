import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS X - Reopen Approved Test One Shot';
const webhookPath = 'wis-x/reopen-approved-test';
const correctedDraft = [
  '[[WIS_X]] Estamos probando cómo nos llevamos con la automatización.',
  '',
  'Si los medios tradicionales ya automatizan gran parte de sus noticias, ¿por qué no podrían hacerlo también las marcas personales?',
  '',
  'La clave es que la mirada y el razonamiento sigan siendo nuestros.',
].join('\n');

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

const shared = await api('/workflows/nEzq5nGzYQ663wXM');
const supabaseNode = shared.nodes.find((node) => node.name === 'Get Latest Pending Post');
if (!supabaseNode?.credentials?.supabaseApi) throw new Error('shared_supabase_credential_not_found');

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({
  id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-one-shot`,
  name,
  type,
  typeVersion,
  position,
  parameters,
  ...extra,
});

const nodes = [
  node('Reopen Webhook', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} }, { webhookId: 'wis-x-reopen-approved-test' }),
  node('Reopen Approved X Draft', 'n8n-nodes-base.supabase', 1, [280, 0], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '12' }] },
    fieldsUi: { fieldValues: [
      { fieldId: 'draft', fieldValue: correctedDraft },
      { fieldId: 'version', fieldValue: '2' },
      { fieldId: 'estado', fieldValue: 'draft_enviado' },
      { fieldId: 'feedback_ortu', fieldValue: 'Corrección de saltos de línea y gramática antes de publicar.' },
    ] },
  }, { credentials: structuredClone(supabaseNode.credentials) }),
  node('Reopen Response', 'n8n-nodes-base.respondToWebhook', 1.4, [560, 0], { respondWith: 'json', responseBody: '={{ { ok: true, post_id: 12, state: "draft_enviado" } }}', options: { responseCode: 200 } }),
];

const body = {
  name: workflowName,
  nodes,
  connections: {
    'Reopen Webhook': { main: [[{ node: 'Reopen Approved X Draft', type: 'main', index: 0 }]] },
    'Reopen Approved X Draft': { main: [[{ node: 'Reopen Response', type: 'main', index: 0 }]] },
  },
  settings: {},
  staticData: null,
};

const existing = (await api('/workflows?limit=100')).data?.find((workflow) => workflow.name === workflowName);
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });

try {
  await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(90000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`webhook_${response.status}`);
  console.log(JSON.stringify({ ok: true, workflow_id: saved.id, reopened_post_id: 12, response: JSON.parse(raw) }));
} finally {
  await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
}
