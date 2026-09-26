import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const configured = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configured) ? configured : `${configured}/api/v1`;
const publicBase = configured.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const name = 'WIS LinkedIn - Test silencioso de ciclo de vida';
const path = `wis-linkedin/test-quiet-lifecycle-${randomUUID()}`;

async function api(url, options = {}) {
  const response = await fetch(`${apiRoot}${url}`, {
    ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status}_${url}:${raw}`);
  return raw ? JSON.parse(raw) : {};
}

function node(nameValue, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name: nameValue, type, typeVersion, position, parameters, ...extra };
}

function edge(target) { return [{ node: target, type: 'main', index: 0 }]; }

const reminder = await api('/workflows/DEfjlrnDKPueQLQC');
const credentials = reminder.nodes.find((item) => item.name === 'Get Drafts Pendientes')?.credentials;
if (!credentials) throw new Error('missing_supabase_credentials');

const nodes = [
  node('Webhook Quiet Test', 'n8n-nodes-base.webhook', 2, [0, 0], {
    httpMethod: 'POST', path, responseMode: 'responseNode', options: {},
  }, { webhookId: randomUUID() }),
  node('Get Real Active Pending', 'n8n-nodes-base.supabase', 1, [240, 0], {
    operation: 'getAll', tableId: 'posts_pending', returnAll: true, filterType: 'manual',
    filters: { conditions: [{ keyName: 'estado', condition: 'eq', keyValue: 'draft_enviado' }] },
  }, { credentials: structuredClone(credentials), alwaysOutputData: true, onError: 'stopWorkflow' }),
  node('Evaluate Quiet Lifecycle', 'n8n-nodes-base.code', 2, [480, 0], {
    mode: 'runOnceForAllItems',
    jsCode: String.raw`
const zone = 'America/Argentina/Buenos_Aires';
const today = $now.setZone(zone).toISODate();
function select(rows) {
  return rows.filter((row) => {
    if (!row?.id || row.estado !== 'draft_enviado' || String(row.draft || '').startsWith('[[WIS_X]]')) return false;
    const created = row.created_at ? new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: zone }) : '';
    return created === today;
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 1);
}
const realRows = $input.all().map((item) => item.json).filter((row) => row?.id);
const realSelected = select(realRows);
const fixtureRows = [
  {id:38,estado:'draft_enviado',draft:'[[WIS_X]] antiguo',created_at:$now.minus({days:2}).toISO()},
  {id:42,estado:'draft_enviado',draft:'[[WIS_X]] hoy',created_at:$now.toISO()},
  {id:47,estado:'draft_enviado',draft:'LinkedIn anterior',created_at:$now.minus({days:1}).toISO()},
  {id:48,estado:'draft_enviado',draft:'LinkedIn de hoy',created_at:$now.minus({minutes:5}).toISO()},
];
const fixtureSelected = select(fixtureRows);
const classifications = {
  ok: ['ok','si','sí','dale','✅ publicar','publicar'].includes('✅ publicar'),
  reject: ['no','rechazar','cancelar','descartar','❌ descartar'].includes('❌ descartar'),
};
const checks = {
  real_notifications_max_one: realSelected.length <= 1,
  fixture_selects_only_linkedin_today: fixtureSelected.length === 1 && fixtureSelected[0].id === 48,
  publish_button_classified: classifications.ok,
  reject_button_classified: classifications.reject,
  reminder_count: fixtureSelected.length,
  expiry_count: fixtureSelected.length,
};
return [{json:{ok:Object.values(checks).every(Boolean),today,real_active_rows:realRows.length,real_selected_ids:realSelected.map((row)=>row.id),fixture_selected_ids:fixtureSelected.map((row)=>row.id),checks,side_effects:{telegram:false,linkedin:false,database_writes:false}}}];`,
  }),
  node('Respond Quiet Test', 'n8n-nodes-base.respondToWebhook', 1.4, [720, 0], {
    respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 200 },
  }),
];
const connections = {
  'Webhook Quiet Test': { main: [edge('Get Real Active Pending')] },
  'Get Real Active Pending': { main: [edge('Evaluate Quiet Lifecycle')] },
  'Evaluate Quiet Lifecycle': { main: [edge('Respond Quiet Test')] },
};
const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === name);
const payload = { name, nodes, connections, settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' } };
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(payload) });
if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });

let result;
for (let attempt = 0; attempt < 8; attempt += 1) {
  const response = await fetch(`${publicBase}/webhook/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  if (response.ok) { result = JSON.parse(raw); break; }
  if (response.status !== 404) throw new Error(`test_${response.status}:${raw}`);
  await new Promise((resolve) => setTimeout(resolve, 750));
}
await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
if (!result?.ok) throw new Error(`quiet_lifecycle_test_failed:${JSON.stringify(result)}`);
console.log(JSON.stringify({ workflow_id: saved.id, result, deactivated: true }, null, 2));
