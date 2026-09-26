import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const DRAFT = `La mayoría de las empresas no necesita más IA.
Necesita dejar de usarla como un juguete.

Cada semana aparecen modelos y actualizaciones nuevas. Pero el negocio no cambia por instalar otra herramienta. Cambia cuando la IA responde clientes, hace seguimiento y evita que una oportunidad se enfríe.

Eso es lo que veo seguido: empresas con mucha tecnología y procesos que todavía dependen de copiar datos, recordar tareas y perseguir respuestas.

En WIS trabajamos justo en ese punto: pasar de la demo a un sistema que venda y opere todos los días.

¿En tu empresa la IA ya trabaja dentro de un proceso real o sigue siendo una pestaña abierta?`;

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
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const writerId = '1ZWaUJr5t3HWFrqa';
const inboundId = 'nEzq5nGzYQ663wXM';
const workflowName = 'WIS LinkedIn - Reemplazar borrador en voz de Ortu';
const webhookPath = 'wis-linkedin/replace-draft-ortu';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}
function edge(target) { return [{ node: target, type: 'main', index: 0 }]; }

async function extractBotSecret() {
  const list = await api(`/executions?workflowId=${writerId}&limit=10`);
  for (const row of list.data || []) {
    const execution = await api(`/executions/${row.id}?includeData=true`);
    const config = execution.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('No se pudo recuperar BOT_SECRET');
}

async function hardenLivePrompts() {
  for (const workflowId of [writerId, inboundId]) {
    const workflow = await api(`/workflows/${workflowId}`);
    const promptName = workflowId === writerId ? 'Build Prompt' : 'Build Regenerate Prompt';
    const parseName = workflowId === writerId ? 'Parse LLM Response' : 'Parse Regen';
    const prompt = workflow.nodes.find((item) => item.name === promptName);
    const parse = workflow.nodes.find((item) => item.name === parseName);
    if (!prompt || !parse) throw new Error(`Faltan nodos en ${workflowId}`);

    if (!prompt.parameters.jsCode.includes('PROHIBIDO EN EL POST FINAL')) {
      prompt.parameters.jsCode = prompt.parameters.jsCode.replace(
        "].join('\\n');",
        "  '- PROHIBIDO EN EL POST FINAL: emojis, HTML, links, nombres de librerías o versiones técnicas, \\\"dar el salto\\\", \\\"quedarse atrás\\\" y promesas genéricas.',\\n].join('\\n');",
      );
    }

    const validation = String.raw`
  const finalPost = parsed.post.trim();
  const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(finalPost);
  const hasMarkup = /<[^>]+>|https?:\/\//i.test(finalPost);
  if (finalPost.length < 350 || finalPost.length > 1000) throw new Error('longitud fuera de 350-1000 caracteres');
  if (hasEmoji || hasMarkup) throw new Error('el post contiene emoji, HTML o links');
  parsed.post = finalPost;`;
    if (!parse.parameters.jsCode.includes('const finalPost = parsed.post.trim()')) {
      parse.parameters.jsCode = parse.parameters.jsCode.replace(
        "if (typeof parsed.post !== 'string' || !parsed.post.trim()) throw new Error('campo post ausente');",
        "if (typeof parsed.post !== 'string' || !parsed.post.trim()) throw new Error('campo post ausente');" + validation,
      );
    }
    const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings };
    await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
    if (workflow.active) await api(`/workflows/${workflowId}/deactivate`, { method: 'POST', body: '{}' });
    await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
  }
}

async function ensureWorkflow() {
  const inbound = await api(`/workflows/${inboundId}`);
  const writer = await api(`/workflows/${writerId}`);
  const configTemplate = inbound.nodes.find((item) => item.name === 'Get Config Inbound');
  const supabaseCredential = inbound.nodes.find((item) => item.name === 'Patch Nuevo Draft')?.credentials;
  const telegramTemplate = writer.nodes.find((item) => item.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredential || !telegramTemplate?.credentials) throw new Error('Faltan credenciales');

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Replace Config';
  getConfig.position = [240, 0];
  const patchDraft = node('Patch Ortu Draft', 'n8n-nodes-base.supabase', 1, [680, 0], {
    operation: 'update', tableId: 'posts_pending', filterType: 'manual',
    filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Replace').first().json.post_id }}" }] },
    fieldsUi: { fieldValues: [
      { fieldId: 'draft', fieldValue: "={{ $('Validate Replace').first().json.draft }}" },
      { fieldId: 'version', fieldValue: '3' },
      { fieldId: 'estado', fieldValue: 'draft_enviado' },
    ] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });
  const enable = node('Enable One Shot For Ortu Draft', 'n8n-nodes-base.supabase', 1, [900, 0], {
    operation: 'update', tableId: 'config', filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'true' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });
  const telegram = structuredClone(telegramTemplate);
  telegram.id = randomUUID();
  telegram.name = 'Telegram Ortu Draft';
  telegram.position = [1120, 0];
  telegram.parameters.text = "={{ 'VERSIÓN 3 — MÁS ORTU, CLARA Y COMERCIAL\\n\\n' + $('Validate Replace').first().json.draft + '\\n\\nRespondé a ESTE mensaje:\\nOK -> publico una sola vez\\neditar: <cambios> -> ajusto\\nno -> descarto' }}";
  telegram.onError = 'stopWorkflow';
  const patchMessage = node('Patch Ortu telegram_msg_id', 'n8n-nodes-base.supabase', 1, [1340, 0], {
    operation: 'update', tableId: 'posts_pending', filterType: 'manual',
    filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate Replace').first().json.post_id }}" }] },
    fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] },
  }, { credentials: structuredClone(supabaseCredential), onError: 'stopWorkflow' });

  const nodes = [
    node('Webhook Replace Ortu', 'n8n-nodes-base.webhook', 2, [20, 0], {
      httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    node('Validate Replace', 'n8n-nodes-base.code', 2, [460, 0], { jsCode: String.raw`
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Webhook Replace Ortu').first().json;
const post_id = Number(req.body?.post_id || 0);
const draft = String(req.body?.draft || '').trim();
const authorized = Boolean(cfg.BOT_SECRET) && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'REPLACE_WITH_ORTU_VOICE'
  && post_id === 8 && draft.length >= 350 && draft.length <= 1000 && !/<[^>]+>|https?:\/\//i.test(draft);
if (!authorized) throw new Error('invalid replacement');
return [{json:{post_id,draft}}];` }),
    patchDraft, enable, telegram, patchMessage,
    node('Respond Replace Ortu', 'n8n-nodes-base.respondToWebhook', 1.4, [1560, 0], {
      respondWith: 'json',
      responseBody: "={{ {ok:true,post_id:$('Validate Replace').first().json.post_id,version:3,characters:$('Validate Replace').first().json.draft.length,telegram_message_id:$json.telegram_msg_id} }}",
      options: { responseCode: 200 },
    }),
  ];
  const connections = {
    'Webhook Replace Ortu': { main: [edge('Get Replace Config')] },
    'Get Replace Config': { main: [edge('Validate Replace')] },
    'Validate Replace': { main: [edge('Patch Ortu Draft')] },
    'Patch Ortu Draft': { main: [edge('Enable One Shot For Ortu Draft')] },
    'Enable One Shot For Ortu Draft': { main: [edge('Telegram Ortu Draft')] },
    'Telegram Ortu Draft': { main: [edge('Patch Ortu telegram_msg_id')] },
    'Patch Ortu telegram_msg_id': { main: [edge('Respond Replace Ortu')] },
  };
  const list = await api('/workflows?limit=100');
  const existing = (list.data || []).find((item) => item.name === workflowName);
  const body = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
  if (saved.active) await api(`/workflows/${saved.id}/deactivate`, { method: 'POST', body: '{}' });
  const active = await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return { id: saved.id, active: active.active };
}

async function invoke(secret) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body: JSON.stringify({ confirm: 'REPLACE_WITH_ORTU_VOICE', post_id: 8, draft: DRAFT }),
      signal: AbortSignal.timeout(30000),
    });
    const raw = await response.text();
    if (response.ok) return JSON.parse(raw);
    if (response.status !== 404) throw new Error(`${response.status}: ${raw}`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('No se registró el webhook de reemplazo');
}

await hardenLivePrompts();
const workflow = await ensureWorkflow();
const secret = await extractBotSecret();
const result = await invoke(secret);
console.log(JSON.stringify({ ok: true, workflow, result, draft: DRAFT }, null, 2));
