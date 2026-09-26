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
const limit = Math.max(1, Math.min(20, Number(process.argv[3] || 1)));
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
const response = await fetch(`${apiRoot}/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${limit}`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
const body = await response.json();
const rows = (body.data || []).map((row) => ({
  id: row.id,
  workflowId: row.workflowId,
  status: row.status,
  startedAt: row.startedAt,
  stoppedAt: row.stoppedAt,
}));
console.log(JSON.stringify(limit === 1 ? (rows[0] || null) : rows, null, 2));
