import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const workflowName = 'WIS X - Editorial Diario IA Argentina';
const telegramCredential = { telegramApi: { id: 'Qv5vY4LFGWET4CUC', name: 'Telegram X Publisher Bot' } };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

const dedicated = await api('/workflows/VT1s1aTNn4y9BZo0');
const supabaseCredentials = structuredClone(dedicated.nodes.find((node) => node.name === 'Get Latest X Pending Post').credentials);
const openAiCredentials = structuredClone(dedicated.nodes.find((node) => node.name === 'Call OpenAI (X regen)').credentials);

const node = (name, type, typeVersion, position, parameters, credentials, extra = {}) => ({
  id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-editorial-20260826`,
  name,
  type,
  typeVersion,
  position,
  parameters,
  ...(credentials ? { credentials } : {}),
  ...extra,
});

const feedUrl = 'https://news.google.com/rss/search?q=%22inteligencia+artificial%22+Argentina+when%3A1d&hl=es-419&gl=AR&ceid=AR%3Aes-419';

const nodes = [
  node('Diario 10:00 ART', 'n8n-nodes-base.scheduleTrigger', 1.2, [-520, -120], {
    rule: { interval: [{ field: 'cronExpression', expression: '0 10 * * *' }] },
  }),
  node('Editorial Run Webhook', 'n8n-nodes-base.webhook', 2, [-520, 80], {
    httpMethod: 'POST', path: 'wis-x/editorial-daily/run', responseMode: 'onReceived', options: {},
  }, null, { webhookId: 'wis-x-editorial-daily-20260826' }),
  node('Buscar noticias del día', 'n8n-nodes-base.httpRequest', 4.2, [-260, 0], {
    method: 'GET', url: feedUrl, options: { response: { response: { responseFormat: 'text' } } },
  }),
  node('Filtrar noticias argentinas de hoy', 'n8n-nodes-base.code', 2, [0, 0], {
    jsCode: `
const raw = String($json.data ?? $json.body ?? $json ?? '');
const decode = (value) => String(value || '')
  .replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'")
  .replace(/\\s+/g, ' ').trim();
const field = (item, tag) => {
  const lower = item.toLowerCase();
  const start = lower.indexOf('<' + tag.toLowerCase());
  if (start < 0) return '';
  const openEnd = lower.indexOf('>', start);
  const end = lower.indexOf('</' + tag.toLowerCase() + '>', openEnd);
  return end < 0 ? '' : decode(item.slice(openEnd + 1, end));
};
const sourceField = (item) => field(item, 'source');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const allowed = ['infobae', 'clarín', 'clarin', 'la nacion', 'la nación', 'tn', 'el cronista', 'ámbito', 'ambito', 'perfil', 'bae negocios', 'forbes argentina', 'página/12', 'pagina/12'];
const items = [...raw.matchAll(/<item>([\\s\\S]*?)<\\/item>/gi)].map((match) => {
  const item = match[1];
  const published = field(item, 'pubDate');
  const sourceName = sourceField(item);
  const url = field(item, 'link');
  const title = field(item, 'title');
  const summary = field(item, 'description');
  const localDate = published ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(published)) : '';
  const haystack = (title + ' ' + summary + ' ' + sourceName + ' ' + url).toLowerCase();
  const sourceOk = allowed.some((name) => sourceName.toLowerCase().includes(name)) || /infobae|clarin|lanacion|tn\\.com|cronista|ambito|perfil\\.com|baenegocios/i.test(url);
  const topicOk = /inteligencia artificial|\\bia\\b|automatiz|agente(s)? de ia|robot|modelo(s)? de lenguaje/i.test(haystack);
  const score = (topicOk ? 10 : 0) + (sourceOk ? 5 : 0) + (/pyme|empresa|negocio|trabajo|empleo|productividad|cliente|ventas|educación|salud/i.test(haystack) ? 4 : 0);
  return { title, url, published, source_name: sourceName || 'Fuente argentina', summary, localDate, sourceOk, topicOk, score };
}).filter((item) => item.localDate === today && item.sourceOk && item.topicOk && item.title && item.url)
  .sort((a, b) => b.score - a.score);
if (!items[0]) return [{ json: { ok: false, reason: 'no_news_today', date: today } }];
return [{ json: { ok: true, date: today, ...items[0] } }];`,
  }),
  node('¿Hay noticia válida?', 'n8n-nodes-base.if', 2.2, [240, 0], {
    conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'news-ok', leftValue: '={{$json.ok}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {},
  }),
  node('Avisar sin noticia', 'n8n-nodes-base.telegram', 1.2, [500, 260], {
    operation: 'sendMessage', chatId: '7512675688', text: "={{ 'No encontré una noticia de IA o automatización de una fuente argentina publicada hoy (' + $json.date + '). No generé ningún borrador.' }}", additionalFields: {},
  }, telegramCredential),
  node('Armar consigna editorial', 'n8n-nodes-base.code', 2, [500, -80], {
    jsCode: `
const s = $json;
const prompt = [
  'Escribí una publicación única para X en español rioplatense.',
  'Está dirigida a dueños de negocios y personas no técnicas de Latinoamérica.',
  'El objetivo es aportar valor y abrir una conversación, no vender servicios.',
  'Tomá la noticia como punto de partida y elaborá una opinión propia: qué significa en la práctica, qué podría mejorar una empresa pequeña o qué debate abre.',
  'No copies el título ni el artículo. No inventes datos. No menciones que sos una IA.',
  'No menciones LinkedIn. No uses hashtags, emojis, markdown ni saltos de línea literales como \\\\n.',
  'Usá lenguaje natural, simple y concreto. Escribí una sola idea en 2 o 3 frases cortas, entre 180 y 240 caracteres para dejar margen dentro del límite de X. Devolvé únicamente JSON válido con la forma {"post":"..."}.',
  '', 'FUENTE:', s.source_name, 'TÍTULO:', s.title, 'RESUMEN:', s.summary.slice(0, 900), 'URL:', s.url,
].join('\\n');
return [{ json: { ...s, prompt } }];`,
  }),
  node('Generar reflexión para X', 'n8n-nodes-base.httpRequest', 4.2, [760, -80], {
    method: 'POST', url: 'https://api.openai.com/v1/chat/completions', sendHeaders: true, headerParameters: { parameters: [{ name: 'content-type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: '= {{ { model: "gpt-4o-mini", messages: [ { role: "user", content: $json.prompt } ], temperature: 0.55 } }}'.replace('= {{', '={{'), options: { response: { response: { responseFormat: 'json' } } },
    authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
  }, openAiCredentials),
  node('Validar reflexión', 'n8n-nodes-base.code', 2, [1020, -80], {
    jsCode: `
const source = $('Armar consigna editorial').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  const cleaned = String(raw || '').replace(/\\x60\\x60\\x60json\\s*/gi, '').replace(/\\x60\\x60\\x60/g, '').trim();
  const parsed = JSON.parse(cleaned.match(/\\{[\\s\\S]*\\}/)?.[0] || cleaned);
  let post = String(parsed.post || '').replace(/\\\\n/g, ' ').replace(/\\\\r/g, '').replace(/\\s+/g, ' ').trim();
  if (post.length > 280) {
    const sentences = post.match(/[^.!?]+[.!?]+/g) || [];
    let compact = '';
    for (const sentence of sentences) {
      const next = (compact + ' ' + sentence.trim()).trim();
      if (next.length > 275) break;
      compact = next;
    }
    post = compact || post.slice(0, 272).replace(/\\s+\\S*$/, '').trim() + '…';
  }
  if (!post || post.length > 280) throw new Error('texto vacío o supera 280 caracteres');
  return [{ json: { ...source, draft_text: post, draft_length: post.length, draft_ok: true } }];
} catch (error) {
  return [{ json: { ...source, draft_ok: false, draft_error: String(error.message).slice(0, 300) } }];
}`,
  }),
  node('¿Reflexión válida?', 'n8n-nodes-base.if', 2.2, [1260, -80], {
    conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'draft-ok', leftValue: '={{$json.draft_ok}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {},
  }),
  node('Buscar X recientes', 'n8n-nodes-base.supabase', 1, [1500, -180], {
    operation: 'getAll', tableId: 'posts_pending', returnAll: true, sort: { property: [{ field: 'created_at', direction: 'DESC' }] },
  }, supabaseCredentials),
  node('Bloquear duplicados', 'n8n-nodes-base.code', 2, [1740, -180], {
    jsCode: `
const candidate = $('Validar reflexión').first().json;
const norm = (value) => String(value || '').replace(/^\\[\\[WIS_X\\]\\]\\s*/i, '').normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const rows = $input.all().map((item) => item.json).filter((row) => row && row.id);
const activeStates = new Set(['draft_enviado', 'aprobado', 'publicado']);
const candidateNorm = norm(candidate.draft_text);
const duplicateText = rows.some((row) => activeStates.has(String(row.estado)) && String(row.draft || '').startsWith('[[WIS_X]]') && norm(row.draft) === candidateNorm);
const duplicateSource = rows.some((row) => activeStates.has(String(row.estado)) && String(row.draft || '').startsWith('[[WIS_X]]') && String(row.feedback_ortu || '').includes(candidate.url));
return [{ json: { ...candidate, duplicate: duplicateText || duplicateSource, duplicate_reason: duplicateText ? 'same_text' : duplicateSource ? 'same_source' : null } }];`,
  }),
  node('¿Es duplicado?', 'n8n-nodes-base.if', 2.2, [1980, -180], {
    conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'duplicate', leftValue: '={{$json.duplicate}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {},
  }),
  node('Avisar duplicado bloqueado', 'n8n-nodes-base.telegram', 1.2, [2220, 80], {
    operation: 'sendMessage', chatId: '7512675688', text: "={{ 'Bloqueé un borrador porque la noticia o el texto ya estaba registrado (' + $json.duplicate_reason + '). No envié nada para publicar.' }}", additionalFields: {},
  }, telegramCredential),
  node('Buscar noticia existente', 'n8n-nodes-base.supabase', 1, [2220, -120], {
    operation: 'getAll', tableId: 'noticias_dia', returnAll: true, sort: { property: [{ field: 'created_at', direction: 'DESC' }] },
  }, supabaseCredentials),
  node('Resolver noticia del día', 'n8n-nodes-base.code', 2, [2460, -120], {
    jsCode: `
const candidate = $('Bloquear duplicados').first().json;
const existing = $input.all().map((item) => item.json).find((row) => String(row.url || '') === String(candidate.url || ''));
return [{ json: { ...candidate, noticia_id: existing?.id || null, noticia_existente: Boolean(existing) } }];`,
  }),
  node('¿Noticia ya registrada?', 'n8n-nodes-base.if', 2.2, [2700, -120], {
    conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'news-existing', leftValue: '={{$json.noticia_existente}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {},
  }),
  node('Guardar noticia del día', 'n8n-nodes-base.supabase', 1, [2220, -260], {
    operation: 'create', tableId: 'noticias_dia', fieldsUi: { fieldValues: [
      { fieldId: 'fecha', fieldValue: '={{$json.date}}' },
      { fieldId: 'fuente', fieldValue: '={{$json.source_name}}' },
      { fieldId: 'url', fieldValue: '={{$json.url}}' },
      { fieldId: 'titulo', fieldValue: '={{$json.title}}' },
      { fieldId: 'resumen', fieldValue: '={{$json.summary}}' },
      { fieldId: 'publicada_at', fieldValue: '={{$json.published}}' },
      { fieldId: 'score', fieldValue: '={{$json.score}}' },
      { fieldId: 'score_razon', fieldValue: 'Noticia diaria seleccionada para reflexión editorial de X' },
      { fieldId: 'seleccionada', fieldValue: 'true' },
      { fieldId: 'procesada', fieldValue: 'false' },
    ] },
  }, supabaseCredentials),
  node('Guardar borrador editorial X', 'n8n-nodes-base.supabase', 1, [2220, -260], {
    operation: 'create', tableId: 'posts_pending', fieldsUi: { fieldValues: [
      { fieldId: 'noticia_id', fieldValue: "={{ $('Resolver noticia del día').first().json.noticia_id || $('Guardar noticia del día').first().json.id }}" },
      { fieldId: 'draft', fieldValue: '={{ "[[WIS_X]] " + $("Bloquear duplicados").first().json.draft_text }}' },
      { fieldId: 'version', fieldValue: '1' },
      { fieldId: 'estado', fieldValue: 'draft_enviado' },
      { fieldId: 'feedback_ortu', fieldValue: '={{ "Fuente: " + $("Bloquear duplicados").first().json.source_name + " | Título: " + $("Bloquear duplicados").first().json.title + " | URL: " + $("Bloquear duplicados").first().json.url + " | Publicada: " + $("Bloquear duplicados").first().json.published + " | Editorial: noticia del día" }}' },
    ] },
  }, supabaseCredentials),
  node('Armar mensaje de revisión editorial', 'n8n-nodes-base.code', 2, [2460, -260], {
    jsCode: `
const j = $('Bloquear duplicados').first().json;
return [{ json: { texto: [
  'BORRADOR EDITORIAL PARA X', '',
  j.draft_text, '',
  'Caracteres: ' + j.draft_length + '/280', '',
  'Fuente: ' + j.source_name, 'Tema: ' + j.title, 'Publicado: ' + j.published, j.url, '',
  'Respondé OK para publicar en X.', 'EDITAR: <cambios>', 'NO para descartar.',
].join('\\n') } }];`,
  }),
  node('Enviar borrador editorial por Telegram', 'n8n-nodes-base.telegram', 1.2, [2700, -260], {
    operation: 'sendMessage', chatId: '7512675688', text: '={{$json.texto}}', additionalFields: {},
  }, telegramCredential),
  node('Guardar mensaje editorial', 'n8n-nodes-base.supabase', 1, [2940, -260], {
    operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Guardar borrador editorial X').first().json.id }}" }] }, fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] },
  }, supabaseCredentials),
  node('Avisar error de generación', 'n8n-nodes-base.telegram', 1.2, [1500, 100], {
    operation: 'sendMessage', chatId: '7512675688', text: "={{ 'No pude generar una reflexión válida para la noticia de hoy. No guardé ningún borrador. Detalle: ' + ($json.draft_error || 'error_desconocido') }}", additionalFields: {},
  }, telegramCredential),
];

const connections = {
  'Diario 10:00 ART': { main: [[{ node: 'Buscar noticias del día', type: 'main', index: 0 }]] },
  'Editorial Run Webhook': { main: [[{ node: 'Buscar noticias del día', type: 'main', index: 0 }]] },
  'Buscar noticias del día': { main: [[{ node: 'Filtrar noticias argentinas de hoy', type: 'main', index: 0 }]] },
  'Filtrar noticias argentinas de hoy': { main: [[{ node: '¿Hay noticia válida?', type: 'main', index: 0 }]] },
  '¿Hay noticia válida?': { main: [[{ node: 'Armar consigna editorial', type: 'main', index: 0 }], [{ node: 'Avisar sin noticia', type: 'main', index: 0 }]] },
  'Armar consigna editorial': { main: [[{ node: 'Generar reflexión para X', type: 'main', index: 0 }]] },
  'Generar reflexión para X': { main: [[{ node: 'Validar reflexión', type: 'main', index: 0 }]] },
  'Validar reflexión': { main: [[{ node: '¿Reflexión válida?', type: 'main', index: 0 }]] },
  '¿Reflexión válida?': { main: [[{ node: 'Buscar X recientes', type: 'main', index: 0 }], [{ node: 'Avisar error de generación', type: 'main', index: 0 }]] },
  'Buscar X recientes': { main: [[{ node: 'Bloquear duplicados', type: 'main', index: 0 }]] },
  'Bloquear duplicados': { main: [[{ node: '¿Es duplicado?', type: 'main', index: 0 }]] },
  '¿Es duplicado?': { main: [[{ node: 'Avisar duplicado bloqueado', type: 'main', index: 0 }], [{ node: 'Buscar noticia existente', type: 'main', index: 0 }]] },
  'Buscar noticia existente': { main: [[{ node: 'Resolver noticia del día', type: 'main', index: 0 }]] },
  'Resolver noticia del día': { main: [[{ node: '¿Noticia ya registrada?', type: 'main', index: 0 }]] },
  '¿Noticia ya registrada?': { main: [[{ node: 'Guardar borrador editorial X', type: 'main', index: 0 }], [{ node: 'Guardar noticia del día', type: 'main', index: 0 }]] },
  'Guardar noticia del día': { main: [[{ node: 'Guardar borrador editorial X', type: 'main', index: 0 }]] },
  'Guardar borrador editorial X': { main: [[{ node: 'Armar mensaje de revisión editorial', type: 'main', index: 0 }]] },
  'Armar mensaje de revisión editorial': { main: [[{ node: 'Enviar borrador editorial por Telegram', type: 'main', index: 0 }]] },
  'Enviar borrador editorial por Telegram': { main: [[{ node: 'Guardar mensaje editorial', type: 'main', index: 0 }]] },
};

const body = { name: workflowName, nodes, connections, settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' } };
const list = await api('/workflows?limit=100');
const existing = (list.data || []).find((item) => item.name === workflowName);
const saved = existing
  ? await api(`/workflows/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(body) });
await api(`/workflows/${saved.id}/activate`, { method: 'POST', body: '{}' });
console.log(JSON.stringify({ ok: true, workflow_id: saved.id, workflow_name: workflowName, active: true, schedule: 'todos los días a las 10:00 ART', test_webhook: '/webhook/wis-x/editorial-daily/run' }));
