import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

async function getExecution(executionId) { return api(`/executions/${executionId}?includeData=true`); }
function nodeJson(execution, nodeName) { return execution.data?.resultData?.runData?.[nodeName]?.[0]?.data?.main?.[0]?.[0]?.json || null; }

const executions = await api('/executions?workflowId=nEzq5nGzYQ663wXM&limit=20');
let botSecret = '';
for (const row of executions.data || []) {
  const full = await getExecution(row.id);
  botSecret ||= String(nodeJson(full, 'Parse Config Inbound')?.BOT_SECRET || '');
  if (botSecret) break;
}
if (!botSecret) throw new Error('test_secret_not_found');

async function replay(text, replyToMessageId) {
  const response = await fetch(`${publicBase}/webhook/wis-linkedin/replay-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': botSecret },
    body: JSON.stringify({ text, reply_to_message_id: replyToMessageId, message_id: Date.now() }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`replay_${response.status}`);
}

async function latestNode(nodeName, after) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const list = await api('/executions?workflowId=nEzq5nGzYQ663wXM&limit=10');
    for (const row of list.data || []) {
      if (after && new Date(row.startedAt).getTime() < after) continue;
      const full = await getExecution(row.id);
      const value = nodeJson(full, nodeName);
      if (value) return { executionId: row.id, value };
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`node_not_reached_${nodeName}`);
}

const firstDraftMessageId = 4216;
const firstRunAt = Date.now();
await replay('Editar: hacelo más directo y centrado en que estamos probando la automatización.', firstDraftMessageId);
const edited = await latestNode('Telegram X Nuevo Draft', firstRunAt);
const editedMessageId = Number(edited.value.result?.message_id);

const rejectRunAt = Date.now();
await replay('NO', editedMessageId);
const rejected = await latestNode('Telegram X Rechazado', rejectRunAt);

console.log(JSON.stringify({ ok: true, edit: { execution_id: edited.executionId, telegram_message_id: editedMessageId }, reject: { execution_id: rejected.executionId, telegram_message_id: rejected.value.result?.message_id || null }, dry_run: true }));
