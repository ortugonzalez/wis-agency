import fs from 'node:fs';

const executionId = process.argv[2] || '193785';
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
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const root = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
const response = await fetch(`${root}/executions/${executionId}?includeData=true`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`n8n_${response.status}`);
const execution = await response.json();
const news = execution.data?.resultData?.runData?.['Get Noticia']?.[0]
  ?.data?.main?.[0]?.[0]?.json || {};
console.log(JSON.stringify({
  id: news.id,
  titulo: news.titulo,
  resumen: news.resumen,
  fuente: news.fuente,
  publicada_at: news.publicada_at,
}, null, 2));
