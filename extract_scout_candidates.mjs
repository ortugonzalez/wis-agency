import fs from 'node:fs';

const executionId = process.argv[2];
const query = String(process.argv.slice(3).join(' ') || '').toLowerCase();
if (!executionId) throw new Error('Uso: node extract_scout_candidates.mjs EXECUTION_ID [BUSQUEDA]');
const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const root = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
const response = await fetch(`${root}/executions/${executionId}?includeData=true`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY }, signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`n8n_${response.status}`);
const execution = await response.json();
const runData = execution.data?.resultData?.runData || {};
const candidates = new Map();
for (const [nodeName, runs] of Object.entries(runData)) {
  for (const run of runs || []) {
    for (const branch of run.data?.main || []) {
      for (const item of branch || []) {
        const row = item.json || {};
        if (!row.id || !row.titulo || !row.url || row.score === undefined) continue;
        candidates.set(String(row.id), {
          id: row.id, titulo: row.titulo, fuente: row.fuente, url: row.url,
          score: row.score, score_razon: row.score_razon, selected: Boolean(row.seleccionada), node: nodeName,
        });
      }
    }
  }
}
const values = [...candidates.values()].filter((row) => !query
  || `${row.titulo} ${row.fuente} ${row.score_razon}`.toLowerCase().includes(query));
console.log(JSON.stringify(values, null, 2));
