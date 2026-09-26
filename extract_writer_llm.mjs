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
const configuredBase = (env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const response = await fetch(`${apiRoot}/executions/${executionId}?includeData=true`, {
  headers: { 'X-N8N-API-KEY': env.N8N_API_KEY },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
const execution = await response.json();
const runData = execution.data?.resultData?.runData || {};
const call = runData['Call OpenAI']?.at(-1)?.data?.main?.[0]?.[0]?.json || {};
const build = runData['Build Prompt']?.at(-1)?.data?.main?.[0]?.[0]?.json || {};
const parsed = runData['Parse LLM Response']?.at(-1)?.data?.main?.[0]?.[0]?.json || {};
let generatedPost = '';
try {
  generatedPost = JSON.parse(call.choices?.[0]?.message?.content || '{}').post || '';
} catch {}
console.log(JSON.stringify({
  model: call.model,
  finish_reason: call.choices?.[0]?.finish_reason,
  content: call.choices?.[0]?.message?.content,
  diagnostics: {
    generated_body_chars: generatedPost.trim().length,
    citation_chars: String(build.citation_line || '').trim().length,
    final_chars: generatedPost.trim().length + (build.citation_line ? 2 + String(build.citation_line).trim().length : 0),
  },
  parser: parsed,
}, null, 2));
