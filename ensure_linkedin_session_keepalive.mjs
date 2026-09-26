import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

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
const workflowName = 'WIS LinkedIn - Renovación diaria de sesión';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}

function edge(target) {
  return { node: target, type: 'main', index: 0 };
}

const conductor = await api('/workflows/AUXgK79OHhhUu2iR');
const telegramTemplate = conductor.nodes.find((item) => item.name === 'Telegram Scout Fail');
if (!telegramTemplate?.credentials) throw new Error('No se encontró la credencial de Telegram');

const schedule = node('Cada día 10:30 ART', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 0], {
  rule: { interval: [{ field: 'cronExpression', expression: '30 10 * * *' }] },
});

const checkSession = node('Renovar sesión LinkedIn', 'n8n-nodes-base.httpRequest', 4.2, [240, 0], {
  url: '={{$env.PLAYWRIGHT_SERVICE_URL}}/session',
  options: { response: { response: { responseFormat: 'json', neverError: true } } },
}, { onError: 'continueRegularOutput' });

const invalid = node('IF Sesión inválida', 'n8n-nodes-base.if', 2.2, [480, 0], {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{
      id: randomUUID(),
      leftValue: '={{ $json.valid !== true }}',
      rightValue: true,
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    }],
    combinator: 'and',
  },
  options: {},
});

const alert = structuredClone(telegramTemplate);
alert.id = randomUUID();
alert.name = 'Telegram Sesión LinkedIn Vencida';
alert.position = [720, -80];
alert.parameters.text = '⚠️ LinkedIn necesita revalidación. La publicación automática quedó bloqueada preventivamente; no se perdió ningún post. Abrí la pantalla segura sólo cuando quieras renovar el acceso.';
alert.onError = 'continueRegularOutput';

const nodes = [schedule, checkSession, invalid, alert];
const connections = {
  'Cada día 10:30 ART': { main: [[edge('Renovar sesión LinkedIn')]] },
  'Renovar sesión LinkedIn': { main: [[edge('IF Sesión inválida')]] },
  'IF Sesión inválida': { main: [[edge('Telegram Sesión LinkedIn Vencida')], []] },
};

const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === workflowName);
const body = {
  name: workflowName,
  nodes,
  connections,
  settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' },
};
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
const activated = await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });

console.log(JSON.stringify({ ok: true, id: saved.id, active: activated.active, schedule: '30 10 * * * ART' }, null, 2));
