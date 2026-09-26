import fs from 'node:fs';

const postId = Number(process.argv[2] || 39);
const noticiaId = Number(process.argv[3] || 0);
if (!noticiaId) throw new Error('Uso: node send_linkedin_latam_practical_draft.mjs POST_ID NOTICIA_ID');
const sourceUrl = 'https://www.iadb.org/es/blog/analisis-economico/inteligencia-artificial-motor-de-productividad-o-de-desigualdad';
const draft = `En América Latina, 8 de cada 10 empresas dicen que ya usan inteligencia artificial. Pero apenas 6 de cada 100 ven un impacto importante.

El dato aparece en un análisis del BID publicado en julio. Eso baja a tierra la discusión: probar una herramienta no es lo mismo que mejorar el trabajo.

Muchas empresas abren una cuenta o piden a sus equipos que “usen IA”. Después siguen midiendo lo mismo, manteniendo los mismos pasos y tomando las mismas decisiones. La herramienta cambia; el proceso, no.

No hace falta entender cómo funciona un modelo. Sí hace falta elegir una tarea concreta: responder consultas, ordenar información, preparar un presupuesto o revisar un documento. Medir cuánto tardaba antes, cuánto tarda ahora y qué errores aparecieron.

En una región donde el tiempo y los costos pesan todos los días, quizás la pregunta no sea si tu empresa usa IA.

¿Hay alguna tarea que realmente esté haciendo mejor gracias a ella?

Fuente: Banco Interamericano de Desarrollo — análisis económico sobre productividad en América Latina y el Caribe, publicado el 27/07/2026. ${sourceUrl}`;

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const body = draft.replace(/\n+Fuente:[\s\S]*$/i, '').trim();
if (body.length < 600 || body.length > 950 || draft.length > 3000) throw new Error(`invalid_length:${body.length}:${draft.length}`);
if ((draft.match(/¿/g) || []).length !== 1 || (draft.match(/https?:\/\/[^\s]+/g) || []).length !== 1) throw new Error('invalid_structure');
const configured = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const base = configured.replace(/\/api\/v1$/i, '');
const apiRoot = /\/api\/v1$/i.test(configured) ? configured : `${configured}/api/v1`;
const listResponse = await fetch(`${apiRoot}/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10`, { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY }, signal: AbortSignal.timeout(30_000) });
let secret = '';
for (const row of (await listResponse.json()).data || []) {
  const response = await fetch(`${apiRoot}/executions/${row.id}?includeData=true`, { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY }, signal: AbortSignal.timeout(30_000) });
  const full = await response.json();
  secret = full.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json?.BOT_SECRET || '';
  if (secret) break;
}
if (!secret) throw new Error('missing_bot_secret');
const response = await fetch(`${base}/webhook/wis-linkedin/replace-pending-secure`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': String(secret) },
  body: JSON.stringify({ confirm: 'REPLACE_PENDING_DRAFT', post_id: postId, noticia_id: noticiaId, draft, source_url: sourceUrl }), signal: AbortSignal.timeout(30_000),
});
const raw = await response.text();
if (!response.ok) throw new Error(`replace_failed_${response.status}:${raw}`);
const result = JSON.parse(raw);
console.log(JSON.stringify({ ok: true, post_id: postId, noticia_id: noticiaId, telegram_message_id: result.telegram_message_id, body_chars: body.length, full_chars: draft.length, published: false }, null, 2));
