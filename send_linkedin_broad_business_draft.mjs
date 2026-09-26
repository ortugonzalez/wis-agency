import fs from 'node:fs';

const postId = Number(process.argv[2] || 39);
const noticiaId = Number(process.argv[3] || 272);
const sourceUrl = 'https://www.uschamberfoundation.org/workforce/half-of-small-business-workers-use-ai-most-to-boost-productivity-not-automate-jobs';
const draft = `La IA ya entró a muchas empresas antes de que sus dueños decidieran qué hacer con ella.

La U.S. Chamber Foundation e Ipsos encuestaron a 1.070 personas de pequeñas empresas de EE.UU. La mitad dijo usar IA. Pero hay otro dato: en el 19% de los casos, la adopción nació de empleados probando herramientas por su cuenta; solo en el 11% vino de una decisión de la organización.

Me recuerda a lo que pasó con WhatsApp en el trabajo: primero apareció porque resolvía algo y recién después llegaron las reglas.

El problema no es que alguien use IA. El problema es que la empresa puede estar compartiendo datos, cambiando procesos o tomando decisiones sin saberlo. Prohibirla tampoco resuelve mucho: la empuja debajo de la mesa.

Para mí, la conversación útil ya no es “usamos IA o no”. Es qué usos aceptamos, con qué información y quién revisa el resultado.

En tu empresa, ¿la IA se está implementando de forma consciente o ya está entrando por atrás?

Fuente: U.S. Chamber of Commerce Foundation / Ipsos — encuesta nacional a 1.070 trabajadores de pequeñas empresas, publicada el 17/06/2026. ${sourceUrl}`;

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const body = draft.replace(/\n+Fuente:[\s\S]*$/i, '').trim();
if (body.length < 600 || body.length > 950 || draft.length > 3000) throw new Error(`invalid_length:${body.length}:${draft.length}`);
if ((draft.match(/¿/g) || []).length !== 1 || (draft.match(/https?:\/\/[^\s]+/g) || []).length !== 1) throw new Error('invalid_structure');
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '').replace(/\/api\/v1$/i, '');
const apiBase = `${base}/api/v1`;
const executionResponse = await fetch(`${apiBase}/executions?workflowId=1ZWaUJr5t3HWFrqa&limit=10`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY }, signal: AbortSignal.timeout(30_000),
});
if (!executionResponse.ok) throw new Error('writer_executions_unavailable');
let secret = '';
for (const row of (await executionResponse.json()).data || []) {
  const response = await fetch(`${apiBase}/executions/${row.id}?includeData=true`, { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY }, signal: AbortSignal.timeout(30_000) });
  const full = await response.json();
  secret = full.data?.resultData?.runData?.['Parse Config']?.[0]?.data?.main?.[0]?.[0]?.json?.BOT_SECRET || '';
  if (secret) break;
}
if (!secret) throw new Error('missing_bot_secret');
const response = await fetch(`${base}/webhook/wis-linkedin/replace-pending-secure`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': String(secret) },
  body: JSON.stringify({ confirm: 'REPLACE_PENDING_DRAFT', post_id: postId, noticia_id: noticiaId, draft, source_url: sourceUrl }),
  signal: AbortSignal.timeout(30_000),
});
const raw = await response.text();
if (!response.ok) throw new Error(`replace_failed_${response.status}:${raw}`);
const result = JSON.parse(raw);
console.log(JSON.stringify({ ok: true, post_id: postId, noticia_id: noticiaId, telegram_message_id: result.telegram_message_id, body_chars: body.length, full_chars: draft.length, published: false }, null, 2));
