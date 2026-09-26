import fs from 'node:fs';

const noticiaId = Number(process.argv[2] || 205);
if (!Number.isInteger(noticiaId) || noticiaId <= 0) throw new Error('invalid_noticia_id');

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
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY };

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return response.json();
}

async function botSecret() {
  const executions = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  for (const row of executions.data || []) {
    const full = await api(`/executions/${row.id}?includeData=true`);
    const config = full.data?.resultData?.runData?.['Parse Config']?.[0]
      ?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('BOT_SECRET unavailable');
}

const secret = await botSecret();
const startedAt = Date.now();
const runId = `RECOVERY-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const response = await fetch(`${publicBase}/webhook/writer/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
  body: JSON.stringify({ run_id: runId, noticia_id: noticiaId }),
  signal: AbortSignal.timeout(210_000),
});
const raw = await response.text();
let body;
try { body = JSON.parse(raw); } catch { body = { parse_error: true }; }
if (!response.ok || body?.ok !== true) throw new Error(`writer_failed:http_${response.status}:${body?.error || 'unknown'}`);

let execution;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const list = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  const row = (list.data || []).find((item) => new Date(item.startedAt).getTime() >= startedAt - 2_000);
  if (row?.stoppedAt) {
    execution = await api(`/executions/${row.id}?includeData=true`);
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
}
if (!execution) throw new Error('writer_execution_timeout');

const runData = execution.data?.resultData?.runData || {};
const telegram = runData['Enviar Telegram Draft']?.[0]?.data?.main?.[0]?.[0]?.json;
const pending = runData['Patch telegram_msg_id']?.[0]?.data?.main?.[0]?.[0]?.json;
if (!telegram?.ok || !telegram?.result?.message_id || !pending?.id) {
  throw new Error('writer_postcondition_failed');
}

console.log(JSON.stringify({
  ok: true,
  execution_id: execution.id,
  run_id: runId,
  noticia_id: noticiaId,
  post_pending_id: pending.id,
  telegram_message_id: telegram.result.message_id,
  estado: pending.estado,
  auto_publish_one_shot: true,
  awaiting_user_ok: true,
  published: false,
  secret_exposed: false,
}, null, 2));
