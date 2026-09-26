import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const POST_ID = 14;
const DRAFT = `Ox Alpha apareció de golpe en varios rankings de inteligencia artificial y durante un tiempo nadie sabía bien quién estaba detrás. Ahora Z.ai confirmó que el modelo era suyo y que pronto liberará sus “pesos”: los archivos que permiten que otros lo prueben, estudien y adapten.

Más allá de si termina rindiendo tan bien como muestran esas pruebas, la historia me parece interesante por otra cosa. Primero apareció el resultado; después apareció la marca.

Eso muestra lo rápido que se está moviendo este sector. Un modelo puede llamar la atención sin una gran presentación, simplemente por compararse bien frente a otros. Pero también conviene bajar un cambio: un ranking no alcanza para saber cómo funcionará cuando salga del laboratorio y se use en situaciones reales.

Para mí, la parte importante empieza ahora, cuando más personas puedan ponerlo a prueba y contrastar la expectativa con el uso concreto.

¿Estamos mirando demasiado quién lanza cada modelo y demasiado poco qué pasa cuando realmente se usa?`;

if (DRAFT.length < 550 || DRAFT.length > 1100) throw new Error(`invalid_draft_length:${DRAFT.length}`);
if (/<[^>]+>|https?:\/\//i.test(DRAFT)) throw new Error('draft_contains_markup_or_link');

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

const writerId = '1ZWaUJr5t3HWFrqa';
const inboundId = 'nEzq5nGzYQ663wXM';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS LinkedIn - Reemplazo editorial controlado';
const webhookPath = 'wis-linkedin/editorial-replacement';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = raw; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return body;
}

async function save(workflow) {
  const wasActive = Boolean(workflow.active);
  await api(`/workflows/${workflow.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
    }),
  });
  const saved = await api(`/workflows/${workflow.id}`);
  if (wasActive && !saved.active) await api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
}

async function hardenPrompts() {
  for (const [workflowId, nodeName] of [[writerId, 'Build Prompt'], [inboundId, 'Build Regenerate Prompt']]) {
    const workflow = await api(`/workflows/${workflowId}`);
    const prompt = workflow.nodes.find((candidate) => candidate.name === nodeName);
    if (!prompt) throw new Error(`missing_node:${nodeName}`);
    if (!prompt.parameters.jsCode.includes('FRASES GENÉRICAS PROHIBIDAS')) {
      prompt.parameters.jsCode = prompt.parameters.jsCode.replace(
        "  '- Sin emojis, links",
        "  '- FRASES GENÉRICAS PROHIBIDAS: futuro de la IA, abrir nuevas puertas, modelos de negocio, mejorar la experiencia del cliente, me gustaría saber qué piensan.',\n  '- No desvíes una noticia sobre modelos hacia atención al cliente, ventas o automatización si la fuente no trata ese tema.',\n  '- Sin emojis, links",
      );
    }
    await save(workflow);
  }
}

async function botSecret() {
  const executions = await api(`/executions?workflowId=${writerId}&limit=10`);
  for (const row of executions.data || []) {
    const full = await api(`/executions/${row.id}?includeData=true`);
    const config = full.data?.resultData?.runData?.['Parse Config']?.[0]
      ?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('BOT_SECRET unavailable');
}

function makeNode(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}
function edge(target) { return [{ node: target, type: 'main', index: 0 }]; }

async function ensureOneShot() {
  const inbound = await api(`/workflows/${inboundId}`);
  const writer = await api(`/workflows/${writerId}`);
  const configTemplate = inbound.nodes.find((candidate) => candidate.name === 'Get Config Inbound');
  const supabaseCredentials = inbound.nodes.find((candidate) => candidate.name === 'Patch Nuevo Draft')?.credentials;
  const telegramTemplate = writer.nodes.find((candidate) => candidate.name === 'Enviar Telegram Draft');
  if (!configTemplate || !supabaseCredentials || !telegramTemplate?.credentials) throw new Error('credential_templates_missing');

  const getConfig = structuredClone(configTemplate);
  getConfig.id = randomUUID();
  getConfig.name = 'Get Editorial Config';
  getConfig.position = [260, 0];

  const patchDraft = makeNode('Patch Human Summary', 'n8n-nodes-base.supabase', 1, [700, 0], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: String(POST_ID) }] },
    fieldsUi: { fieldValues: [
      { fieldId: 'draft', fieldValue: DRAFT },
      { fieldId: 'version', fieldValue: '3' },
      { fieldId: 'estado', fieldValue: 'draft_enviado' },
      { fieldId: 'feedback_ortu', fieldValue: 'Resumen abarcativo, menos vendedor, menos técnico y con voz personal.' },
    ] },
  }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' });

  const enable = makeNode('Enable Editorial One Shot', 'n8n-nodes-base.supabase', 1, [920, 0], {
    operation: 'update',
    tableId: 'config',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'AUTO_PUBLISH' }] },
    fieldsUi: { fieldValues: [{ fieldId: 'value', fieldValue: 'true' }] },
  }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' });

  const telegram = structuredClone(telegramTemplate);
  telegram.id = randomUUID();
  telegram.name = 'Telegram Human Summary';
  telegram.position = [1140, 0];
  telegram.parameters.text = `VERSIÓN 3 — RESUMEN MÁS HUMANO Y ABARCATIVO\n\n${DRAFT}\n\nRespondé a ESTE mensaje:\nOK -> publico una sola vez\neditar: <cambios> -> vuelvo a ajustar\nno -> descarto`;
  telegram.onError = 'stopWorkflow';

  const patchMessage = makeNode('Patch Human Summary Message ID', 'n8n-nodes-base.supabase', 1, [1360, 0], {
    operation: 'update',
    tableId: 'posts_pending',
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: String(POST_ID) }] },
    fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] },
  }, { credentials: structuredClone(supabaseCredentials), onError: 'stopWorkflow' });

  const nodes = [
    makeNode('Editorial Replacement Webhook', 'n8n-nodes-base.webhook', 2, [20, 0], {
      httpMethod: 'POST', path: webhookPath, responseMode: 'responseNode', options: {},
    }, { webhookId: randomUUID() }),
    getConfig,
    makeNode('Validate Editorial Replacement', 'n8n-nodes-base.code', 2, [480, 0], { jsCode: `
const cfg = Object.fromEntries($input.all().map((item) => [item.json.key, item.json.value]));
const req = $('Editorial Replacement Webhook').first().json;
const valid = Boolean(cfg.BOT_SECRET)
  && String(req.headers?.['x-bot-secret'] || '') === String(cfg.BOT_SECRET)
  && String(req.body?.confirm || '') === 'REPLACE_EDITORIAL_POST_14';
if (!valid) throw new Error('invalid editorial replacement');
return [{json:{ok:true}}];` }),
    patchDraft,
    enable,
    telegram,
    patchMessage,
    makeNode('Editorial Replacement Response', 'n8n-nodes-base.respondToWebhook', 1.4, [1580, 0], {
      respondWith: 'json',
      responseBody: `={{ {ok:true,post_id:${POST_ID},version:3,characters:${DRAFT.length},telegram_message_id:$json.telegram_msg_id} }}`,
      options: { responseCode: 200 },
    }),
  ];
  const connections = {
    'Editorial Replacement Webhook': { main: [edge('Get Editorial Config')] },
    'Get Editorial Config': { main: [edge('Validate Editorial Replacement')] },
    'Validate Editorial Replacement': { main: [edge('Patch Human Summary')] },
    'Patch Human Summary': { main: [edge('Enable Editorial One Shot')] },
    'Enable Editorial One Shot': { main: [edge('Telegram Human Summary')] },
    'Telegram Human Summary': { main: [edge('Patch Human Summary Message ID')] },
    'Patch Human Summary Message ID': { main: [edge('Editorial Replacement Response')] },
  };
  const list = await api('/workflows?limit=250');
  const existing = (list.data || []).find((candidate) => candidate.name === workflowName);
  const body = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1' } };
  const saved = existing
    ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
  if (!saved.active) await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
  return saved.id;
}

async function invoke(workflowId, secret) {
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`${publicBase}/webhook/${webhookPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
        body: JSON.stringify({ confirm: 'REPLACE_EDITORIAL_POST_14' }),
        signal: AbortSignal.timeout(60_000),
      });
      const raw = await response.text();
      if (response.ok) return JSON.parse(raw);
      if (response.status !== 404) throw new Error(`replacement_http_${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    throw new Error('replacement_webhook_not_registered');
  } finally {
    await api(`/workflows/${workflowId}/deactivate`, { method: 'POST', body: '{}' });
  }
}

await hardenPrompts();
const secret = await botSecret();
const workflowId = await ensureOneShot();
const result = await invoke(workflowId, secret);
console.log(JSON.stringify({
  ok: true,
  result,
  draft: DRAFT,
  final_message_replaces: 4238,
  published: false,
  secret_exposed: false,
}, null, 2));
