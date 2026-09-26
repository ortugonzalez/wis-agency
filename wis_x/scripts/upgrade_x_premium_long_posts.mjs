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

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

const LONG_LIMIT = 3500;
const DAILY_TARGET = 1100;
const dailyId = '7T4PbznyXXnAO60C';
const daily = await api(`/workflows/${dailyId}`);
const dailyPrompt = daily.nodes.find((node) => node.name === 'Armar consigna editorial');
const dailyValidator = daily.nodes.find((node) => node.name === 'Validar reflexión');
const dailyMessage = daily.nodes.find((node) => node.name === 'Armar mensaje de revisión editorial');
if (!dailyPrompt || !dailyValidator || !dailyMessage) throw new Error('daily_editorial_nodes_not_found');
dailyPrompt.parameters.jsCode = dailyPrompt.parameters.jsCode
  .replace('Escribí una publicación única para X en español rioplatense.', 'Escribí una publicación única y desarrollada para X en español rioplatense.')
  .replace('Usá lenguaje natural, simple y concreto. Escribí una sola idea en 2 o 3 frases cortas, entre 180 y 240 caracteres para dejar margen dentro del límite de X. Devolvé únicamente JSON válido con la forma {"post":"..."}.', 'Usá lenguaje natural, simple y concreto. Desarrollá una sola idea en 5 a 8 párrafos breves, entre 650 y 1100 caracteres para aprovechar Premium sin volverlo pesado. Nunca superes 3500 caracteres. Devolvé únicamente JSON válido con la forma {"post":"..."}.');
dailyValidator.parameters.jsCode = dailyValidator.parameters.jsCode
  .replace('if (post.length > 280)', `if (post.length > ${LONG_LIMIT})`)
  .replace('if (next.length > 275)', `if (next.length > ${LONG_LIMIT - 50})`)
  .replace("post.slice(0, 272).replace(/\\s+\\S*$/, '').trim() + '…'", `post.slice(0, ${LONG_LIMIT - 53}).replace(/\\s+\\S*$/, '').trim() + '…'`)
  .replace('if (!post || post.length > 280)', `if (!post || post.length > ${LONG_LIMIT})`)
  .replace(`if (post.length > ${LONG_LIMIT})`, `if (post.length > ${DAILY_TARGET})`)
  .replace(`if (next.length > ${LONG_LIMIT - 50})`, `if (next.length > ${DAILY_TARGET - 50})`)
  .replace(`post.slice(0, ${LONG_LIMIT - 53})`, `post.slice(0, ${DAILY_TARGET - 53})`);
dailyMessage.parameters.jsCode = dailyMessage.parameters.jsCode.replace("j.draft_length + '/280'", `j.draft_length + '/${DAILY_TARGET}'`).replace("j.draft_length + '/3500'", `j.draft_length + '/${DAILY_TARGET}'`);
await api(`/workflows/${dailyId}`, { method: 'PUT', body: JSON.stringify({ name: daily.name, nodes: daily.nodes, connections: daily.connections, settings: daily.settings, staticData: daily.staticData }) });

const dedicatedId = 'VT1s1aTNn4y9BZo0';
const dedicated = await api(`/workflows/${dedicatedId}`);
const regenPrompt = dedicated.nodes.find((node) => node.name === 'Build X Regenerate Prompt');
const regenParser = dedicated.nodes.find((node) => node.name === 'Parse X Regen');
const regenMessage = dedicated.nodes.find((node) => node.name === 'Build X Nuevo Draft Msg');
if (!regenPrompt || !regenParser || !regenMessage) throw new Error('dedicated_long_post_nodes_not_found');
regenPrompt.parameters.jsCode = regenPrompt.parameters.jsCode
  .replace('Máximo 280 caracteres ponderados. No uses emojis ni links.', `Entre 650 y 1100 caracteres, con un máximo absoluto de ${LONG_LIMIT}. No uses emojis ni links.`);
regenParser.parameters.jsCode = `
const prev = $('Build X Regenerate Prompt').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  const cleaned = String(raw || '').replace(/\\x60\\x60\\x60json\\s*/gi, '').replace(/\\x60\\x60\\x60/g, '').trim();
  const parsed = JSON.parse(cleaned.match(/\\{[\\s\\S]*\\}/)?.[0] || cleaned);
  let post = String(parsed.post || '').replace(/\\\\n/g, ' ').replace(/\\\\r/g, '').replace(/\\s+/g, ' ').trim();
  if (post.length > ${LONG_LIMIT}) {
    const sentences = post.match(/[^.!?]+[.!?]+/g) || [];
    let compact = '';
    for (const sentence of sentences) {
      const next = (compact + ' ' + sentence.trim()).trim();
      if (next.length > ${LONG_LIMIT - 50}) break;
      compact = next;
    }
    post = compact || post.slice(0, ${LONG_LIMIT - 53}).replace(/\\s+\\S*$/, '').trim() + '…';
  }
  if (!post || post.length > ${LONG_LIMIT}) throw new Error('post vacío o supera ${LONG_LIMIT} caracteres');
  return [{ json: { regen_ok: true, post, estimated_length: post.length, post_id: prev.post_id, version_nueva: prev.version_anterior + 1 } }];
} catch (error) {
  return [{ json: { regen_ok: false, post_id: prev.post_id, error: 'x_regen_invalid', detail: String(error.message).slice(0, 300) } }];
}`;
regenMessage.parameters.jsCode = regenMessage.parameters.jsCode.replace("j.estimated_length + '/280'", `j.estimated_length + '/${LONG_LIMIT}'`);
await api(`/workflows/${dedicatedId}`, { method: 'PUT', body: JSON.stringify({ name: dedicated.name, nodes: dedicated.nodes, connections: dedicated.connections, settings: dedicated.settings, staticData: dedicated.staticData }) });

console.log(JSON.stringify({ ok: true, daily_workflow_id: dailyId, dedicated_workflow_id: dedicatedId, long_post_limit: LONG_LIMIT, daily_target: DAILY_TARGET, telegram_safe: true, x_publish_approval_required: true }));
