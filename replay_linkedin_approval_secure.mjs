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

const workflowId = 'nEzq5nGzYQ663wXM';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const webhookPath = 'wis-linkedin/replay-approval';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

async function extractBotSecret() {
  const list = await api('/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10');
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar el secreto compartido');
}

const workflow = await api(`/workflows/${workflowId}`);
const configTemplate = workflow.nodes.find((node) => node.name === 'Get Config Inbound');
if (!configTemplate) throw new Error('No se encontró Get Config Inbound');

const replayWebhook = {
  id: randomUUID(),
  webhookId: randomUUID(),
  name: 'Webhook Replay Approval',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [-160, 300],
  parameters: { httpMethod: 'POST', path: webhookPath, responseMode: 'onReceived', options: {} },
};
const getConfigReplay = structuredClone(configTemplate);
getConfigReplay.id = randomUUID();
getConfigReplay.name = 'Get Config Replay';
getConfigReplay.position = [60, 300];
const buildReplay = {
  id: randomUUID(),
  name: 'Build Authenticated Replay',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [280, 300],
  parameters: { jsCode: String.raw`
const rows = $input.all().map((item) => item.json);
const cfg = Object.fromEntries(rows.map((row) => [row.key, row.value]));
const req = $('Webhook Replay Approval').first().json;
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET);
const body = req.body || {};
const id = authorized ? 7512675688 : 0;
const requestedText = String(body.text || 'OK').slice(0, 1500);
return [{json:{message:{
  message_id:Number(body.message_id || Date.now()),
  from:{id,is_bot:false,first_name:'Ortu'},
  chat:{id,type:'private',first_name:'Ortu'},
  date:Math.floor(Date.now()/1000),
  text:authorized ? requestedText : '',
  reply_to_message:{message_id:Number(body.reply_to_message_id || 0)},
}}}];` },
};

for (const newNode of [replayWebhook, getConfigReplay, buildReplay]) {
  const index = workflow.nodes.findIndex((node) => node.name === newNode.name);
  if (index >= 0) workflow.nodes[index] = newNode;
  else workflow.nodes.push(newNode);
}
workflow.connections['Webhook Replay Approval'] = {
  main: [[{ node: 'Get Config Replay', type: 'main', index: 0 }]],
};
workflow.connections['Get Config Replay'] = {
  main: [[{ node: 'Build Authenticated Replay', type: 'main', index: 0 }]],
};
workflow.connections['Build Authenticated Replay'] = {
  main: [[{ node: 'Extract & Normalize', type: 'main', index: 0 }]],
};

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
};
await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
await api(`/workflows/${workflowId}/deactivate`, { method: 'POST', body: '{}' });
await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });

const secret = await extractBotSecret();
const replyToMessageId = Number(process.argv[2] || 0);
const replayText = String(process.argv.slice(3).join(' ') || 'OK');
if (!replyToMessageId) throw new Error('Uso: node replay_linkedin_approval_secure.mjs REPLY_TO_MESSAGE_ID [TEXTO]');
let lastError = '';
for (let attempt = 0; attempt < 8; attempt += 1) {
  const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify({ reply_to_message_id: replyToMessageId, message_id: Date.now(), text: replayText }),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  if (response.ok) {
    console.log(JSON.stringify({ ok: true, accepted: true, status: response.status }, null, 2));
    process.exit(0);
  }
  lastError = `${response.status}: ${raw}`;
  await new Promise((resolve) => setTimeout(resolve, 750));
}
throw new Error(`No se pudo invocar replay seguro: ${lastError}`);
