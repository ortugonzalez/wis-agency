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

const executionId = process.argv[2];
if (!executionId) throw new Error('Falta execution id');
const configuredBase = (env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const response = await fetch(`${apiRoot}/executions/${executionId}?includeData=true`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
const execution = await response.json();
const runData = execution.data?.resultData?.runData || {};

function itemsFor(nodeName) {
  return (runData[nodeName] || []).flatMap((run) =>
    (run.data?.main || []).flatMap((branch) => (branch || []).map((item) => item.json || {})),
  );
}

const selected = itemsFor('Supabase - Marcar seleccionada').at(-1) || {};
const scored = itemsFor('Code - Parse score').find((item) => item.id === selected.id)
  || itemsFor('Code - Seleccionar Mejor').find((item) => item.id === selected.id)
  || {};

console.log(JSON.stringify({
  execution_id: executionId,
  status: execution.status,
  selected: {
    id: selected.id,
    titulo: selected.titulo,
    fuente: selected.fuente,
    url: selected.url,
    resumen: selected.resumen,
    score: selected.score,
    score_razon: selected.score_razon,
    score_tipo: scored.score_tipo,
    score_audiencia: scored.score_audiencia,
    score_evidencia: scored.score_evidencia,
    score_tecnicismo: scored.score_tecnicismo,
  },
}, null, 2));
