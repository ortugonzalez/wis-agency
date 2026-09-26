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

const writerId = '1ZWaUJr5t3HWFrqa';
const inboundId = 'nEzq5nGzYQ663wXM';
const replyToMessageId = Number(process.argv[2] || 4236);
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

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

function node(workflow, name) {
  const value = workflow.nodes.find((candidate) => candidate.name === name);
  if (!value) throw new Error(`missing_node:${name}`);
  return value;
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
  let saved = await api(`/workflows/${workflow.id}`);
  if (wasActive && !saved.active) {
    await api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
    saved = await api(`/workflows/${workflow.id}`);
  }
  if (wasActive && !saved.active) throw new Error(`workflow_inactive_after_save:${workflow.id}`);
  return saved;
}

async function tuneWriter() {
  const workflow = await api(`/workflows/${writerId}`);
  const build = node(workflow, 'Build Prompt');
  const call = node(workflow, 'Call OpenAI');
  const parse = node(workflow, 'Parse LLM Response');
  const telegram = node(workflow, 'Build Telegram Message');

  build.parameters.jsCode = String.raw`
const styleCard = $env.STYLE_CARD_TEXT || '(usar las reglas editoriales incluidas en este prompt)';
const noticia = $('Get Noticia').first().json || {};
const fewShot = ($('Get Few-Shot Corpus').all() || []).map(i => i.json.texto).join('\n---\n');
const runId = $('Webhook - Writer Run').first().json.body.run_id;
const noticiaId = $('Webhook - Writer Run').first().json.body.noticia_id;
const rules = [
  'OBJETIVO EDITORIAL — RESUMEN CON MIRADA PERSONAL:',
  '- Escribí un resumen interpretado de la noticia: más abarcativo, humano y fácil de entender; menos vendedor y menos técnico.',
  '- Mezcla de estilo: 70% forma real de hablar de Ortu y 30% recursos de posts de alto engagement en LinkedIn.',
  '- Los recursos de engagement permitidos son: gancho honesto, contexto progresivo, una observación personal y una pregunta genuina.',
  '- No uses fórmulas de falsa viralidad, clickbait, exageraciones ni frases cortadas artificialmente cada tres palabras.',
  '- Entre 650 y 1000 caracteres; máximo absoluto 1100. Párrafos breves de una a tres oraciones.',
  '- En las primeras dos líneas explicá qué pasó y por qué vale la pena prestarle atención.',
  '- Después ampliá: contexto, qué cambia, a quién puede afectar y qué todavía no está claro.',
  '- Separá hechos de opinión con expresiones naturales: para mí, yo veo, lo interesante es, mi lectura es.',
  '- Si hay conceptos técnicos, traducilos a palabras cotidianas. Conservá precisión sin escribir como un especialista.',
  '- No conviertas automáticamente la noticia en ventas, captación, ahorro de costos o una propuesta de WIS.',
  '- No menciones WIS salvo que la experiencia propia sea indispensable para entender la reflexión.',
  '- Cerrá con una pregunta abierta que admita respuestas distintas. No uses CTA comercial.',
  '- Sin emojis, links dentro del post, HTML, hashtags forzados ni cifras inventadas.',
].join('\n');
const prompt = [
  'Sos el redactor de LinkedIn de Ortu (Octavio González).',
  rules,
  '',
  'NOTICIA A RESUMIR:',
  'Título: ' + (noticia.titulo || ''),
  'Fuente: ' + (noticia.fuente || ''),
  'Resumen disponible: ' + (noticia.resumen || ''),
  'Fecha publicada: ' + (noticia.publicada_at || ''),
  '',
  'REFERENCIA DE VOZ:', styleCard,
  '',
  'MUESTRAS REALES DE ORTU:', fewShot,
  '',
  'No copies estructuras ni frases de las muestras. Capturá su ritmo y criterio.',
  'Devolvé únicamente JSON válido:',
  '{"post":"...","hook_char_count":0,"total_char_count":0,"checklist_ok":true,"razonamiento_breve":"..."}',
].join('\n');
return [{ json: { prompt, run_id: runId, noticia_id: noticiaId, noticia_titulo: noticia.titulo, noticia_url: noticia.url } }];`;

  call.parameters.jsonBody = '={{ { model: "gpt-4o-mini", messages: [ { role: "user", content: $json.prompt } ], temperature: 0.7 } }}';
  parse.parameters.jsCode = parse.parameters.jsCode
    .replace("finalPost.length < 350 || finalPost.length > 1000", "finalPost.length < 550 || finalPost.length > 1100")
    .replace("longitud fuera de 350-1000 caracteres", "longitud fuera de 550-1100 caracteres");
  telegram.parameters.jsCode = telegram.parameters.jsCode
    .replace('INFORME DIARIO + BORRADOR LINKEDIN', 'RESUMEN DEL DÍA + BORRADOR LINKEDIN');

  return save(workflow);
}

async function tuneInbound() {
  const workflow = await api(`/workflows/${inboundId}`);
  const build = node(workflow, 'Build Regenerate Prompt');
  const call = node(workflow, 'Call OpenAI (regen)');
  const parse = node(workflow, 'Parse Regen');
  const message = node(workflow, 'Build Nuevo Draft Msg');
  const editFilter = node(workflow, 'Filter: Editar');
  const pendingTemplate = node(workflow, 'Get Latest Pending Post');

  // Correlate replies against every active LinkedIn draft. The previous limit=1
  // returned an arbitrary stale row, so valid replies to newer drafts were lost.
  pendingTemplate.parameters.returnAll = true;
  delete pendingTemplate.parameters.limit;

  const newsNodeName = 'Get Noticia for LinkedIn Regen';
  let news = workflow.nodes.find((candidate) => candidate.name === newsNodeName);
  if (!news) {
    news = {
      id: 'linkedin-regen-news-context-20260826',
      name: newsNodeName,
      type: 'n8n-nodes-base.supabase',
      typeVersion: 1,
      position: [1220, 80],
      parameters: {
        operation: 'get',
        tableId: 'noticias_dia',
        filters: { conditions: [{
          keyName: 'id',
          condition: 'eq',
          keyValue: "={{ $('Route').first().json.post.noticia_id }}",
        }] },
      },
      credentials: structuredClone(pendingTemplate.credentials),
      onError: 'continueRegularOutput',
      alwaysOutputData: true,
    };
    workflow.nodes.push(news);
  }

  workflow.connections[editFilter.name] = { main: [[{ node: newsNodeName, type: 'main', index: 0 }]] };
  workflow.connections[newsNodeName] = { main: [[{ node: build.name, type: 'main', index: 0 }]] };

  build.parameters.jsCode = String.raw`
const j = $('Route').first().json;
const noticia = $('Get Noticia for LinkedIn Regen').first().json || {};
const rules = [
  'RECONVERSIÓN EDITORIAL SOLICITADA POR ORTU:',
  '- Reescribí desde cero como un resumen interpretado, más abarcativo, menos vendedor y un poco menos técnico.',
  '- Mezcla 70% voz de Ortu y 30% recursos de posts de LinkedIn que generan conversación.',
  '- Abrí con un gancho honesto que explique qué pasó y por qué importa; no uses clickbait.',
  '- Sumá contexto, consecuencias amplias y los grises o preguntas que siguen abiertas.',
  '- Usá primera persona con naturalidad, sin convertir todo en una experiencia propia.',
  '- Traducí términos técnicos a lenguaje cotidiano sin perder precisión.',
  '- Entre 650 y 1000 caracteres; máximo 1100. Párrafos de una a tres oraciones.',
  '- No vendas WIS, no ofrezcas servicios y no fuerces una conclusión sobre ventas o costos.',
  '- Cerrá con una pregunta genuina, no con un CTA comercial.',
  '- Sin emojis, links, HTML, hashtags forzados ni fórmulas como nadie habla de esto o guardá este post.',
].join('\n');
const prompt = [
  'POST ANTERIOR (versión ' + j.post.version + '):', j.post.draft,
  '',
  'NOTICIA ORIGINAL:',
  'Título: ' + (noticia.titulo || ''),
  'Fuente: ' + (noticia.fuente || ''),
  'Resumen: ' + (noticia.resumen || ''),
  '',
  'FEEDBACK DE ORTU:', j.feedback,
  '', rules,
  '',
  'Devolvé únicamente JSON válido:',
  '{"post":"...","hook_char_count":0,"total_char_count":0,"checklist_ok":true,"razonamiento_breve":"..."}',
].join('\n');
return [{ json: { prompt, post_id: j.post.id, version_anterior: Number(j.post.version || 1) } }];`;

  call.parameters.jsonBody = '={{ { model: "gpt-4o-mini", messages: [ { role: "user", content: $json.prompt } ], temperature: 0.7 } }}';
  parse.parameters.jsCode = parse.parameters.jsCode
    .replace("finalPost.length < 350 || finalPost.length > 1000", "finalPost.length < 550 || finalPost.length > 1100")
    .replace("longitud fuera de 350-1000 caracteres", "longitud fuera de 550-1100 caracteres");
  message.parameters.jsCode = String.raw`
const j = $('Parse Regen').first().json;
return [{ json: { texto: 'NUEVA VERSIÓN — MÁS HUMANA Y ABARCATIVA (v' + j.version_nueva + ')\n\n' + j.post
  + '\n\nRespondé a ESTE mensaje:\nOK -> publico una sola vez\neditar: <cambios> -> vuelvo a ajustar\nno -> descarto' } }];`;

  return save(workflow);
}

async function readBotSecret() {
  const executions = await api(`/executions?workflowId=${writerId}&limit=10`);
  for (const row of executions.data || []) {
    const full = await api(`/executions/${row.id}?includeData=true`);
    const config = full.data?.resultData?.runData?.['Parse Config']?.[0]
      ?.data?.main?.[0]?.[0]?.json;
    if (config?.BOT_SECRET) return String(config.BOT_SECRET);
  }
  throw new Error('BOT_SECRET unavailable');
}

async function regenerate(secret) {
  const feedback = 'editar: quiero que LinkedIn sea un resumen más abarcativo de la noticia, menos vendedor y un poco menos técnico. Hacé un mix entre mi forma de hablar y los recursos de posts que generan conversación, sin fórmulas artificiales.';
  const startedAt = Date.now();
  const response = await fetch(`${publicBase}/webhook/wis-linkedin/replay-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify({
      reply_to_message_id: replyToMessageId,
      message_id: Date.now(),
      text: feedback,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`replay_http_${response.status}`);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const executions = await api(`/executions?workflowId=${inboundId}&limit=10`);
    const row = (executions.data || []).find((candidate) => new Date(candidate.startedAt).getTime() >= startedAt - 2_000);
    if (row?.stoppedAt) {
      const full = await api(`/executions/${row.id}?includeData=true`);
      const runData = full.data?.resultData?.runData || {};
      const parsed = runData['Parse Regen']?.[0]?.data?.main?.[0]?.[0]?.json;
      const telegram = runData['Telegram Nuevo Draft']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (full.status !== 'success' || !parsed?.regen_ok || !telegram?.result?.message_id) {
        const detail = parsed?.detail || runData['Telegram Regen Error']?.[0]?.error?.message || 'unknown';
        throw new Error(`regeneration_failed:${row.id}:${detail}`);
      }
      return {
        execution_id: row.id,
        post_id: parsed.post_id,
        version: parsed.version_nueva,
        characters: String(parsed.post || '').length,
        telegram_message_id: telegram.result.message_id,
        post: parsed.post,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('regeneration_timeout');
}

const writer = await tuneWriter();
const inbound = await tuneInbound();
const secret = await readBotSecret();
const result = await regenerate(secret);
console.log(JSON.stringify({
  ok: true,
  writer_active: writer.active,
  inbound_active: inbound.active,
  editorial_profile: '70% Ortu / 30% high-engagement LinkedIn patterns',
  result,
  old_message_invalidated: true,
  published: false,
  secret_exposed: false,
}, null, 2));
