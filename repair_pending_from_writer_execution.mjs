import fs from 'node:fs';

const executionId = process.argv[2];
const postId = Number(process.argv[3] || 0);
const publisher = String(process.argv[4] || '').trim();
if (!executionId || !postId || !publisher) throw new Error('Uso: node repair_pending_from_writer_execution.mjs EXECUTION_ID POST_ID PUBLISHER');

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
const apiHeaders = { 'X-N8N-API-KEY': env.N8N_API_KEY };

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, { headers: apiHeaders, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return response.json();
}

const execution = await api(`/executions/${executionId}?includeData=true`);
const runData = execution.data?.resultData?.runData || {};
const parsed = runData['Parse LLM Response']?.at(-1)?.data?.main?.[0]?.[0]?.json || {};
const config = runData['Parse Config']?.at(-1)?.data?.main?.[0]?.[0]?.json || {};
if (!parsed.parse_ok || !parsed.post || !parsed.noticia_url) throw new Error('invalid_writer_execution');
if (!config.BOT_SECRET) throw new Error('missing_bot_secret');

let draft = String(parsed.post)
  .replace(/(^|[.!]\s+|\n+)(?:Porque|Que)\s+([a-záéíóúñ])/g,
    (_, prefix, firstLetter) => prefix + firstLetter.toUpperCase())
  .replace(/(^|\n)Fuente:\s*[^—\n]+—/i, `$1Fuente: ${publisher} —`)
  .trim();
const body = draft.replace(/\n+Fuente:[\s\S]*$/i, '').trim();
const urls = draft.match(/https?:\/\/[^\s]+/g) || [];
if (body.length < 600 || body.length > 950 || draft.length > 3000) throw new Error('repaired_draft_length_invalid');
if (urls.length !== 1 || urls[0] !== parsed.noticia_url) throw new Error('repaired_citation_invalid');
if ((draft.match(/¿/g) || []).length !== 1) throw new Error('repaired_question_count_invalid');

const response = await fetch(`${publicBase}/webhook/wis-linkedin/replace-pending-secure`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': String(config.BOT_SECRET) },
  body: JSON.stringify({ confirm: 'REPLACE_PENDING_DRAFT', post_id: postId, draft, source_url: parsed.noticia_url }),
  signal: AbortSignal.timeout(30_000),
});
const raw = await response.text();
if (!response.ok) throw new Error(`replace_failed_${response.status}:${raw}`);
const result = JSON.parse(raw);
console.log(JSON.stringify({
  ok: true,
  post_id: postId,
  telegram_message_id: result.telegram_message_id,
  body_chars: body.length,
  full_chars: draft.length,
  questions: 1,
  urls: 1,
  publisher,
  published: false,
}, null, 2));
