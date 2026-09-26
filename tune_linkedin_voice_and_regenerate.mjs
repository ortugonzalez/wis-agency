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
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
const writerId = '1ZWaUJr5t3HWFrqa';
const inboundId = 'nEzq5nGzYQ663wXM';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

async function saveAndActivate(workflow) {
  const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings };
  await api(`/workflows/${workflow.id}`, { method: 'PUT', body: JSON.stringify(body) });
  if (workflow.active) await api(`/workflows/${workflow.id}/deactivate`, { method: 'POST', body: '{}' });
  return api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
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

async function tuneWriter() {
  const workflow = await api(`/workflows/${writerId}`);
  const build = workflow.nodes.find((item) => item.name === 'Build Prompt');
  const call = workflow.nodes.find((item) => item.name === 'Call OpenAI');
  if (!build || !call) throw new Error('Faltan nodos del Writer');

  build.parameters.jsCode = String.raw`
const styleCard = $env.STYLE_CARD_TEXT || '(ver style_card.txt)';
const noticia = $('Get Noticia').first().json || {};
const fewShot = ($('Get Few-Shot Corpus').all() || []).map(i => i.json.texto).join('\n---\n');
const runId = $('Webhook - Writer Run').first().json.body.run_id;
const noticiaId = $('Webhook - Writer Run').first().json.body.noticia_id;
const voice = [
  'PRIORIDAD ABSOLUTA — VOZ COMERCIAL DE ORTU:',
  '- Escribí como un founder que habla con dueños y responsables de empresas, no como un periodista ni un consultor académico.',
  '- 450 a 850 caracteres; máximo 1000. Párrafos de una o dos líneas.',
  '- Primera persona natural: yo veo, para mí, lo que estamos probando. Español rioplatense y directo.',
  '- La noticia es sólo el disparador. Explicá rápido qué oportunidad, costo, riesgo o ventaja concreta abre para una empresa.',
  '- Debe ser más vendedor: conectar con ventas, atención, seguimiento, costos, velocidad o experiencia del cliente.',
  '- Se permite una mención breve a WIS o a experiencia propia si suma credibilidad.',
  '- Cierre con pregunta directa o CTA comercial suave. Nada de resumen neutro ni moraleja genérica.',
  '- Sin introducciones largas, sin cinco explicaciones, sin lenguaje técnico innecesario y sin inventar cifras.',
].join('\n');
const prompt = [
  'Sos el redactor de LinkedIn de Ortu (Octavio González), founder de WIS Agency.',
  voice,
  '',
  'La style card histórica sirve sólo como referencia secundaria. Si contradice la prioridad anterior, gana la prioridad anterior.',
  'STYLE CARD HISTÓRICA:', styleCard,
  '',
  'NOTICIA:',
  'Título: ' + (noticia.titulo || ''),
  'Fuente: ' + (noticia.fuente || ''),
  'URL: ' + (noticia.url || ''),
  'Resumen: ' + (noticia.resumen || ''),
  '',
  'MUESTRAS DE VOZ DE ORTU:', fewShot,
  '',
  'Escribí un único post. Devolvé sólo JSON:',
  '{"post":"...","hook_char_count":0,"total_char_count":0,"checklist_ok":true,"razonamiento_breve":"..."}',
].join('\n');
return [{ json: { prompt, run_id: runId, noticia_id: noticiaId, noticia_titulo: noticia.titulo, noticia_url: noticia.url } }];`;
  if (typeof call.parameters.jsonBody === 'string') {
    call.parameters.jsonBody = call.parameters.jsonBody.replace(/temperature:\s*[0-9.]+/, 'temperature: 0.65');
  }
  const active = await saveAndActivate(workflow);
  return active.active;
}

async function tuneInbound() {
  const workflow = await api(`/workflows/${inboundId}`);
  const build = workflow.nodes.find((item) => item.name === 'Build Regenerate Prompt');
  const call = workflow.nodes.find((item) => item.name === 'Call OpenAI (regen)');
  const message = workflow.nodes.find((item) => item.name === 'Build Nuevo Draft Msg');
  const replay = workflow.nodes.find((item) => item.name === 'Build Authenticated Replay');
  if (!build || !call || !message || !replay) throw new Error('Faltan nodos de regeneración');

  build.parameters.jsCode = String.raw`
const styleCard = $env.STYLE_CARD_TEXT || '(ver style_card.txt)';
const j = $('Route').first().json;
const voice = [
  'REGLAS PRIORITARIAS PARA ESTA VERSIÓN:',
  '- 450 a 850 caracteres; máximo 1000.',
  '- Escribí en primera persona como Ortu, founder y vendedor consultivo: directo, claro, rioplatense y con postura.',
  '- Abrí con una tesis fuerte. En las primeras dos líneas tiene que entenderse la oportunidad o el problema de negocio.',
  '- La noticia es contexto, no el protagonista. Traducila a ventas, atención, costos, velocidad, seguimiento o experiencia del cliente.',
  '- Una sola idea central, párrafos breves y cero tono académico o informe neutral.',
  '- Se permite una mención breve a WIS o a lo que estamos viendo con clientes.',
  '- Cerrá con una pregunta directa o CTA comercial suave.',
  '- No inventes cifras ni promesas. No uses frases vacías sobre el futuro.',
].join('\n');
const prompt = [
  'POST ANTERIOR (versión ' + j.post.version + '):', j.post.draft,
  '', 'FEEDBACK DE ORTU:', j.feedback,
  '', voice,
  '', 'La style card siguiente es secundaria; si contradice estas reglas o el feedback, ignorá esa parte:', styleCard,
  '', 'Regenerá desde cero conservando sólo la idea útil. Devolvé únicamente JSON:',
  '{"post":"...","hook_char_count":0,"total_char_count":0,"checklist_ok":true,"razonamiento_breve":"..."}',
].join('\n');
return [{ json: { prompt, post_id: j.post.id, version_anterior: Number(j.post.version || 1) } }];`;
  if (typeof call.parameters.jsonBody === 'string') {
    call.parameters.jsonBody = call.parameters.jsonBody.replace(/temperature:\s*[0-9.]+/, 'temperature: 0.65');
  }
  message.parameters.jsCode = String.raw`
const j = $('Parse Regen').first().json;
return [{ json: { texto: 'NUEVA VERSIÓN — MÁS DIRECTA Y COMERCIAL (v' + j.version_nueva + ')\n\n' + j.post
  + '\n\nRespondé a ESTE mensaje:\nOK -> publico una sola vez\neditar: <cambios> -> vuelvo a ajustar\nno -> descarto' } }];`;
  replay.parameters.jsCode = String.raw`
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
}}}];`;
  const active = await saveAndActivate(workflow);
  return active.active;
}

async function invokeRegeneration(secret, startedAt) {
  const feedback = 'editar: rehacelo mucho más corto, claro y vendedor. Quiero que suene a mí: primera persona, postura fuerte, foco en el problema y la oportunidad para empresas, menos explicación neutral y un cierre comercial sutil. Máximo 850 caracteres.';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${publicBase}/webhook/wis-linkedin/replay-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
      body: JSON.stringify({ reply_to_message_id: 4197, message_id: Date.now(), text: feedback }),
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) break;
    if (response.status !== 404) throw new Error(`${response.status}: ${await response.text()}`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const list = await api(`/executions?workflowId=${inboundId}&limit=10`);
    const row = (list.data || []).find((item) => new Date(item.startedAt).getTime() >= startedAt - 2000);
    if (row?.stoppedAt) {
      const execution = await api(`/executions/${row.id}?includeData=true`);
      const runData = execution.data?.resultData?.runData || {};
      const parsed = runData['Parse Regen']?.[0]?.data?.main?.[0]?.[0]?.json;
      const telegram = runData['Telegram Nuevo Draft']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (execution.status !== 'success' || !parsed?.regen_ok || !telegram?.result?.message_id) {
        throw new Error(`Regeneración falló en ejecución ${row.id}`);
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Timeout esperando regeneración');
}

const writerActive = await tuneWriter();
const inboundActive = await tuneInbound();
const secret = await extractBotSecret();
const startedAt = Date.now();
const result = await invokeRegeneration(secret, startedAt);
console.log(JSON.stringify({ ok: true, writer_active: writerActive, inbound_active: inboundActive, result }, null, 2));
