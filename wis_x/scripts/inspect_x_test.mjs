import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }));
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const root = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY };
async function api(path) { const r = await fetch(`${root}${path}`, { headers, signal: AbortSignal.timeout(30000) }); const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; } if (!r.ok) throw new Error(`n8n_${r.status}`); return json; }
const list = await api('/workflows?limit=100');
const workflow = (list.data || []).find((item) => item.name === 'WIS X - Telegram Test One Shot');
if (!workflow) throw new Error('workflow_not_found');
const executions = await api(`/executions?workflowId=${workflow.id}&limit=3`);
const details = [];
for (const row of executions.data || []) {
  const execution = await api(`/executions/${row.id}?includeData=true`);
  const runData = execution.data?.resultData?.runData || {};
  details.push({ id: row.id, status: row.status, nodes: Object.fromEntries(Object.entries(runData).map(([name, runs]) => [name, { error: runs?.[0]?.error?.message || null, output: runs?.[0]?.data?.main?.[0]?.[0]?.json || null }])) });
}
console.log(JSON.stringify({ workflow_id: workflow.id, active: workflow.active, executions: details }, null, 2));
