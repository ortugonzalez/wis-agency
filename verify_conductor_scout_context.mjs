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
const response = await fetch(`${apiRoot}/workflows/AUXgK79OHhhUu2iR`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`n8n_${response.status}`);
const workflow = await response.json();
const callScout = workflow.nodes.find((node) => node.name === 'Call Scout');
if (!callScout) throw new Error('missing_node:Call Scout');
const header = callScout.parameters.headerParameters.parameters
  .find((candidate) => String(candidate.name).toLowerCase() === 'x-bot-secret');
const problems = [];
if (!String(header?.value || '').includes("$('Set run_id fecha').first().json.BOT_SECRET")) {
  problems.push('header_does_not_use_stable_context');
}
if (!String(callScout.parameters.jsonBody || '').includes("$('Set run_id fecha').first().json.run_id")) {
  problems.push('run_id_does_not_use_stable_context');
}
if (!String(callScout.parameters.jsonBody || '').includes("$('Set run_id fecha').first().json.fecha")) {
  problems.push('fecha_does_not_use_stable_context');
}
if (!workflow.active) problems.push('conductor_inactive');
if (problems.length) throw new Error(`verification_failed:${problems.join(',')}`);
console.log(JSON.stringify({ ok: true, workflow_id: workflow.id, active: workflow.active, problems: [] }));
