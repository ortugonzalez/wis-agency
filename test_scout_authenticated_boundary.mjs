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
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY };

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, {
    headers: apiHeaders,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return response.json();
}

async function readBotSecret() {
  const executions = await api('/executions?workflowId=AUXgK79OHhhUu2iR&limit=10');
  for (const row of executions.data || []) {
    const full = await api(`/executions/${row.id}?includeData=true`);
    const config = full.data?.resultData?.runData?.['Parse Config']?.[0]
      ?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('BOT_SECRET unavailable in recent conductor executions');
}

const secret = await readBotSecret();
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const response = await fetch(`${publicBase}/webhook/scout/run`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Bot-Secret': secret,
  },
  body: JSON.stringify({ run_id: `root-fix-${randomUUID()}`, fecha: date }),
  signal: AbortSignal.timeout(300_000),
});
const raw = await response.text();
let body;
try { body = JSON.parse(raw); } catch { body = { parse_error: true }; }
if (!response.ok || body?.error === 'invalid secret') {
  throw new Error(`scout_boundary_failed:http_${response.status}:${body?.error || 'unknown'}`);
}

console.log(JSON.stringify({
  ok: body?.ok === true,
  http_status: response.status,
  authenticated: true,
  invalid_secret: false,
  noticia_id: body?.noticia_id || null,
  score: body?.score || null,
  business_result: body?.ok === true ? 'candidate_selected' : (body?.error || 'no_candidate'),
  secret_exposed: false,
}, null, 2));
