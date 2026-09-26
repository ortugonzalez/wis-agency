import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const root = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
const list = await (await fetch(`${root}/executions?workflowId=7T4PbznyXXnAO60C&limit=3`, { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } })).json();
const latest = [...(list.data || [])].sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))[0];
const execution = latest ? await (await fetch(`${root}/executions/${latest.id}?includeData=true`, { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } })).json() : null;
const runData = execution?.data?.resultData?.runData || {};
const node = (name) => runData[name]?.at(-1)?.data?.main?.[0]?.[0]?.json || null;
const draft = node('Validar reflexión') || node('Normalizar reflexión') || {};
const saved = node('Guardar borrador editorial X') || {};
const sent = node('Enviar revisión a Telegram') || node('Enviar borrador editorial por Telegram') || {};
const storedMessage = node('Guardar mensaje editorial') || {};
console.log(JSON.stringify({
  execution: latest ? { id: latest.id, status: latest.status, startedAt: latest.startedAt, stoppedAt: latest.stoppedAt } : null,
  post: draft.post || draft.text || '',
  length: String(draft.post || draft.text || '').length,
  draft_keys: Object.keys(draft),
  draft_preview: draft,
  saved: { id: saved.id, noticia_id: saved.noticia_id, url: saved.url },
  telegram: { message_id: sent.message_id || sent.result?.message_id || storedMessage.telegram_msg_id, ok: sent.ok, keys: Object.keys(sent), preview: sent, stored: { id: storedMessage.id, telegram_msg_id: storedMessage.telegram_msg_id } },
  nodes: Object.keys(runData),
  error: latest?.status === 'error' ? latest.error : undefined,
}, null, 2));
