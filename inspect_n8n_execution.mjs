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

const executionId = process.argv[2];
if (!executionId) throw new Error('Falta execution id');
const requestedNodes = new Set(process.argv.slice(3));
const configuredBase = (env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const response = await fetch(`${apiRoot}/executions/${executionId}?includeData=true`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
const execution = await response.json();

function shape(value, depth = 0) {
  if (depth >= 3) return Array.isArray(value) ? `[array:${value.length}]` : typeof value;
  if (value === null) return null;
  if (Array.isArray(value)) return value.slice(0, 2).map((entry) => shape(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      if (/text|draft|prompt|secret|token|authorization/i.test(key)) return [key, '[REDACTED]'];
      if (/url/i.test(key) && typeof entry === 'string') return [key, '[URL]'];
      return [key, shape(entry, depth + 1)];
    }));
  }
  return value;
}

const runData = execution.data?.resultData?.runData || {};
const nodes = Object.fromEntries(Object.entries(runData)
  .filter(([name]) => requestedNodes.size === 0 || requestedNodes.has(name))
  .map(([name, runs]) => [name, runs.map((run) => ({
  executionStatus: run.executionStatus,
  error: run.error ? { message: run.error.message, description: run.error.description } : undefined,
  data: shape(run.data),
  outputs: (run.data?.main || []).map((output) => (output || []).slice(0, 3).map((item) => {
    const json = item?.json || {};
    return {
      keys: Object.keys(json),
      id: json.id,
      ok: json.ok,
      post_pending_id: json.post_pending_id,
      message_id: json.message_id,
      result_message_id: json.result?.message_id,
      result_chat_id: json.result?.chat?.id,
      error_value: typeof json.error === 'string' ? json.error : json.error?.message,
      safe_config: name === 'Parse Config' ? {
        SYSTEM_ENABLED: json.SYSTEM_ENABLED,
        AUTO_PUBLISH: json.AUTO_PUBLISH,
        MIN_SCORE: json.MIN_SCORE,
      } : undefined,
    };
  })),
}))]));

console.log(JSON.stringify({
  id: execution.id,
  workflowId: execution.workflowId,
  status: execution.status,
  startedAt: execution.startedAt,
  stoppedAt: execution.stoppedAt,
  nodes,
}, null, 2));
