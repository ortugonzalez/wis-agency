import fs from 'node:fs';

const envPath = 'C:/Users/Operador/Desktop/Playground/.env';
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
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
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY };

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = raw; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return body;
}

function relevant(workflow) {
  return /linkedin|wis x|telegram inbound|session keepalive/i.test(workflow.name || '')
    || ['um0levNI0wM7FROb', 'AUXgK79OHhhUu2iR', '1ZWaUJr5t3HWFrqa', 'nEzq5nGzYQ663wXM', 'UT2tHkciz8i8C1KJ'].includes(workflow.id);
}

function safeNodeResult(run) {
  const output = run?.data?.main?.flat()?.[0]?.json || {};
  return {
    execution_status: run?.executionStatus || null,
    error: run?.error ? {
      message: run.error.message || null,
      description: run.error.description || null,
      http_code: run.error.httpCode || null,
    } : null,
    output: {
      keys: Object.keys(output),
      route: output.route,
      platform: output.platform,
      estado: output.estado,
      post_id: output.post?.id || output.post_id || output.id,
      telegram_message_id: output.result?.message_id || output.telegram_msg_id,
      x_post_id: output.data?.id,
      ok: output.ok,
    },
  };
}

const list = await api('/workflows?limit=250');
const workflows = (list.data || []).filter(relevant);
const result = [];

for (const workflow of workflows) {
  const executions = await api(`/executions?workflowId=${encodeURIComponent(workflow.id)}&limit=5`);
  const recent = [];
  for (const row of executions.data || []) {
    const full = await api(`/executions/${row.id}?includeData=true`);
    const runData = full.data?.resultData?.runData || {};
    const errors = Object.entries(runData)
      .filter(([, runs]) => runs?.some((run) => run?.error))
      .map(([name, runs]) => ({ name, ...safeNodeResult(runs.find((run) => run?.error)) }));
    const important = Object.fromEntries(
      Object.entries(runData)
        .filter(([name]) => /Route|Publish|Publicado|Error|Telegram|Writer|Scout|Health|Patch|Config/i.test(name))
        .map(([name, runs]) => [name, safeNodeResult(runs?.[0])]),
    );
    recent.push({
      id: row.id,
      status: row.status,
      started_at: row.startedAt,
      stopped_at: row.stoppedAt,
      errors,
      important,
    });
  }
  result.push({
    id: workflow.id,
    name: workflow.name,
    active: workflow.active,
    updated_at: workflow.updatedAt,
    recent,
  });
}

console.log(JSON.stringify({ checked_at: new Date().toISOString(), workflows: result }, null, 2));
