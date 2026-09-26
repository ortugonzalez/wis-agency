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
const tweetId = '2092287372482240921';
const workflowName = 'WIS X - Delete Published Test One Shot';
const webhookPath = 'wis-x/delete-published-test';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

const shared = await api('/workflows/nEzq5nGzYQ663wXM');
const publishNode = shared.nodes.find((node) => node.name === 'Publish X Approved Post');
if (!publishNode?.credentials?.twitterOAuth2Api) throw new Error('x_credential_not_found');

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-one-shot`, name, type, typeVersion, position, parameters, ...extra });
const nodes = [
  node('Delete Webhook', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {} }, { webhookId: 'wis-x-delete-published-test' }),
  node('Delete X Test Post', 'n8n-nodes-base.httpRequest', 4.2, [280, 0], { method: 'DELETE', url: `https://api.x.com/2/tweets/${tweetId}`, authentication: 'predefinedCredentialType', nodeCredentialType: 'twitterOAuth2Api', options: {} }, { credentials: structuredClone(publishNode.credentials) }),
  node('Delete Response', 'n8n-nodes-base.respondToWebhook', 1.4, [560, 0], { respondWith: 'json', responseBody: `={{ { ok: true, tweet_id: '${tweetId}', deleted: $json.data?.deleted === true } }}`, options: { responseCode: 200 } }),
];
const body = {
  name: workflowName,
  nodes,
  connections: {
    'Delete Webhook': { main: [[{ node: 'Delete X Test Post', type: 'main', index: 0 }]] },
    'Delete X Test Post': { main: [[{ node: 'Delete Response', type: 'main', index: 0 }]] },
  },
  settings: {},
  staticData: null,
};
const existing = (await api('/workflows?limit=100')).data?.find((workflow) => workflow.name === workflowName);
const saved = existing ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) }) : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
try {
  await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(90000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`webhook_${response.status}`);
  console.log(JSON.stringify({ ok: true, tweet_id: tweetId, response: JSON.parse(raw) }));
} finally {
  await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
}
