import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/).map((line) => line.trim())
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
const scoutId = 'um0levNI0wM7FROb';
const writerId = '1ZWaUJr5t3HWFrqa';

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

async function post(path, body, secret, timeout) {
  const response = await fetch(`${publicBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${raw}`);
  return data;
}

async function extractBotSecret() {
  const list = await api(`/executions?workflowId=${writerId}&limit=10`);
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar BOT_SECRET');
}

async function latestExecution(workflowId, after) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const list = await api(`/executions?workflowId=${workflowId}&limit=10`);
    const row = (list.data || []).find((item) => new Date(item.startedAt).getTime() >= after - 2000);
    if (row?.stoppedAt) return api(`/executions/${row.id}?includeData=true`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timeout esperando ejecución ${workflowId}`);
}

function nodeRan(execution, name) {
  return Boolean(execution.data?.resultData?.runData?.[name]?.length);
}

function firstJson(execution, name) {
  return execution.data?.resultData?.runData?.[name]?.[0]?.data?.main?.[0]?.[0]?.json;
}

const secret = await extractBotSecret();
const now = new Date();
const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const fecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);
const runId = `DAILY-FIRST-${stamp}`;

const scoutStarted = Date.now();
const scout = await post('/webhook/scout/run', { run_id: runId, fecha }, secret, 240000);
const scoutExecution = await latestExecution(scoutId, scoutStarted);
if (scoutExecution.status !== 'success') throw new Error('Scout no terminó correctamente');

const noticiaId = scout.ok === true ? Number(scout.noticia_id) : 173;
if (!Number.isInteger(noticiaId) || noticiaId <= 0) throw new Error('Scout no devolvió noticia utilizable');

const writerStarted = Date.now();
const writer = await post('/webhook/writer/run', { run_id: runId, noticia_id: noticiaId }, secret, 210000);
const writerExecution = await latestExecution(writerId, writerStarted);
if (writerExecution.status !== 'success' || writer.ok !== true) throw new Error('Writer no terminó correctamente');
for (const required of ['Enable Auto Publish For Draft', 'Enviar Telegram Draft', 'Patch telegram_msg_id', 'Marcar noticia procesada']) {
  if (!nodeRan(writerExecution, required)) throw new Error(`No se ejecutó ${required}`);
}

const telegram = firstJson(writerExecution, 'Enviar Telegram Draft') || {};
const patched = firstJson(writerExecution, 'Patch telegram_msg_id') || {};
console.log(JSON.stringify({
  ok: true,
  run_id: runId,
  scout: { selected_new: scout.ok === true, noticia_id: noticiaId },
  writer: {
    post_pending_id: writer.post_pending_id,
    telegram_message_id: telegram.result?.message_id || patched.telegram_msg_id,
    auto_publish_one_shot: true,
    awaiting_user_reply: true,
  },
}, null, 2));
