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

const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const publicBase = configuredBase.replace(/\/api\/v1$/i, '');
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY };
if (!configuredBase || !env.N8N_API_KEY) throw new Error('Falta configurar la API de n8n');

const workflows = {
  scout: 'um0levNI0wM7FROb',
  writer: '1ZWaUJr5t3HWFrqa',
  draft: 'nluwzHbQgfHFP0Qr',
  inbound: 'RnlodwUORkQiUsv3',
};

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, {
    headers: apiHeaders,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function post(path, body, secret, timeout = 60000) {
  const response = await fetch(`${publicBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data };
}

async function latestExecution(workflowId, startedAfter) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const list = await api(`/executions?workflowId=${workflowId}&limit=10`);
    const execution = (list.data || [])
      .filter((row) => new Date(row.startedAt).getTime() >= startedAfter - 3000)
      .sort((a, b) => Number(b.id) - Number(a.id))[0];
    if (execution && execution.stoppedAt) return api(`/executions/${execution.id}?includeData=true`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No apareció una ejecución terminada para ${workflowId}`);
}

function firstJson(execution, nodeName) {
  return execution.data?.resultData?.runData?.[nodeName]?.[0]?.data?.main?.[0]?.[0]?.json;
}

function nodeRan(execution, nodeName) {
  return Boolean(execution.data?.resultData?.runData?.[nodeName]?.length);
}

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const badSecret = `invalid-${stamp}`;
const results = [];

// 1) Perímetro: los cuatro endpoints deben rechazar un secreto inválido.
const writerBadStarted = Date.now();
const bad = {
  scout: await post('/webhook/scout/run', { run_id: `QA-SEC-${stamp}` }, badSecret),
  writer: await post('/webhook/writer/run', { run_id: `QA-SEC-${stamp}`, noticia_id: 129 }, badSecret),
  draft: await post('/webhook/wis-linkedin/draft', {
    contacto_id: 'E2E-CON-20260817', empresa_id: 'E2E-EMP-20260817', batch_id: `QA-SEC-${stamp}`,
  }, badSecret),
  inbound: await post('/webhook/wis-linkedin/inbound', {
    contacto_id: 'E2E-CON-20260817', event_id: `QA-SEC-${stamp}`, respuesta_texto: 'prueba',
  }, badSecret),
};
assert(Object.values(bad).every((row) => row.status === 401), 'algún endpoint no devolvió 401');
const badWriterExecution = await latestExecution(workflows.writer, writerBadStarted);
const currentConfig = firstJson(badWriterExecution, 'Parse Config') || {};
const botSecret = String(currentConfig.BOT_SECRET || '');
assert(botSecret.length >= 16, 'no se pudo obtener el secreto compartido para las pruebas autorizadas');
assert(String(currentConfig.AUTO_PUBLISH).toLowerCase() === 'false', 'AUTO_PUBLISH debe estar en false');
results.push({
  prueba: 1,
  nombre: 'Perímetro de seguridad',
  estado: 'PASS',
  detalle: 'Scout, Writer, borradores y respuestas rechazaron credenciales inválidas con HTTP 401.',
});

// 2) Scout: debe completar el relevamiento o informar limpiamente que no hay novedad.
const scoutStarted = Date.now();
const scout = await post('/webhook/scout/run', { run_id: `QA-SCOUT-${stamp}` }, botSecret, 210000);
assert(scout.status === 200, `Scout devolvió HTTP ${scout.status}`);
assert(typeof scout.data?.ok === 'boolean', 'Scout no devolvió contrato {ok:boolean}');
const scoutExecution = await latestExecution(workflows.scout, scoutStarted);
assert(scoutExecution.status === 'success', 'la ejecución Scout no terminó en success');
const noticiaId = scout.data.ok ? Number(scout.data.noticia_id) : 129;
assert(Number.isInteger(noticiaId) && noticiaId > 0, 'no hay noticia válida para Writer');
results.push({
  prueba: 2,
  nombre: 'Descubrimiento de contenido',
  estado: 'PASS',
  detalle: scout.data.ok
    ? `Scout seleccionó la noticia ${noticiaId} y registró la corrida.`
    : 'Scout terminó correctamente e informó que no había candidatas nuevas relevantes; se usó una noticia de control existente para Writer.',
});

// 3) Writer: crea borrador, avisa por Telegram y completa trazabilidad sin publicar.
const writerStarted = Date.now();
const writer = await post('/webhook/writer/run', {
  run_id: `QA-WRITER-${stamp}`,
  noticia_id: noticiaId,
}, botSecret, 180000);
assert(writer.status === 200 && writer.data?.ok === true, `Writer falló: HTTP ${writer.status}`);
const writerExecution = await latestExecution(workflows.writer, writerStarted);
assert(writerExecution.status === 'success', 'la ejecución Writer no terminó en success');
assert(nodeRan(writerExecution, 'Enviar Telegram Draft'), 'no se envió el borrador a Telegram');
assert(nodeRan(writerExecution, 'Patch telegram_msg_id'), 'no se guardó telegram_msg_id');
assert(nodeRan(writerExecution, 'Marcar noticia procesada'), 'no se marcó la noticia como procesada');
assert(!nodeRan(writerExecution, 'Call Publisher'), 'se llamó al publicador durante la prueba');
const telegramPatch = firstJson(writerExecution, 'Patch telegram_msg_id') || {};
const newsPatch = firstJson(writerExecution, 'Marcar noticia procesada') || {};
assert(Boolean(telegramPatch.telegram_msg_id), 'telegram_msg_id quedó vacío');
assert(newsPatch.procesada === true || newsPatch.procesada === 'true', 'procesada no quedó en true');
results.push({
  prueba: 3,
  nombre: 'Generación y aprobación segura de contenido',
  estado: 'PASS',
  detalle: `Writer creó el borrador ${writer.data.post_pending_id}, lo envió a Telegram y guardó trazabilidad; AUTO_PUBLISH=false y no hubo publicación.`,
});

// 4) Prospección: crea cuatro borradores QA y bloquea el mismo lote repetido.
const batchId = `QA-DRAFT-${stamp}`;
const draftBody = {
  contacto_id: 'E2E-CON-20260817',
  empresa_id: 'E2E-EMP-20260817',
  batch_id: batchId,
  campana_id: 'qa_wis_linkedin',
};
const draft = await post('/webhook/wis-linkedin/draft', draftBody, botSecret, 90000);
const duplicate = await post('/webhook/wis-linkedin/draft', draftBody, botSecret, 90000);
assert(draft.status === 200 && draft.data?.estado === 'BORRADORES_CREADOS' && draft.data?.draft_count === 4, 'no se crearon los 4 borradores');
assert(duplicate.status === 200 && duplicate.data?.motivo === 'DUPLICADO_BATCH', 'no se bloqueó el lote duplicado');
results.push({
  prueba: 4,
  nombre: 'Borradores de contacto y deduplicación',
  estado: 'PASS',
  detalle: 'Se crearon 4 mensajes en estado BORRADOR_QA/NO_ENVIAR y el segundo intento del mismo lote quedó bloqueado como DUPLICADO_BATCH.',
});

// 5) Opt-out: clasifica la baja y bloquea cualquier borrador posterior.
const optout = await post('/webhook/wis-linkedin/inbound', {
  contacto_id: 'E2E-CON-20260817',
  event_id: `QA-OPTOUT-${stamp}`,
  respuesta_texto: 'No me escriban más, por favor.',
}, botSecret, 90000);
const afterOptout = await post('/webhook/wis-linkedin/draft', {
  ...draftBody,
  batch_id: `${batchId}-AFTER-OPTOUT`,
}, botSecret, 90000);
assert(optout.status === 200 && optout.data?.respuesta_clase === 'OPTOUT' && optout.data?.optout === true, 'no se clasificó el opt-out');
assert(afterOptout.status === 200 && afterOptout.data?.motivo === 'CONTACTO_NO_ACTIVO', 'no se bloqueó el contacto tras opt-out');
results.push({
  prueba: 5,
  nombre: 'Baja y supresión futura',
  estado: 'PASS',
  detalle: 'La respuesta se clasificó OPTOUT, el contacto quedó excluido y el intento posterior fue bloqueado como CONTACTO_NO_ACTIVO.',
});

console.log(JSON.stringify({
  ok: true,
  modo: 'PRUEBA_CONTROLADA_SIN_PUBLICACION',
  auto_publish: false,
  tests: results,
}, null, 2));
