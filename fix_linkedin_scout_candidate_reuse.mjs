import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
const workflowId = 'um0levNI0wM7FROb';
const base = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const root = /\/api\/v1$/i.test(base) ? base : `${base}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
async function api(path, options = {}) {
  const response = await fetch(`${root}${path}`, { ...options, headers, signal: AbortSignal.timeout(30_000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}:${raw}`);
  return raw ? JSON.parse(raw) : {};
}
const workflow = await api(`/workflows/${workflowId}`);
const ifName = 'IF - Candidata reutilizable';
const attachName = 'Code - Reusar ID existente';
let changed = false;
if (!workflow.nodes.some((node) => node.name === ifName)) {
  workflow.nodes.push({
    id: randomUUID(), name: ifName, type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1280, 160],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: randomUUID(), leftValue: '={{ Number($json.existing_id || 0) }}', rightValue: 0, operator: { type: 'number', operation: 'gt' } }], combinator: 'and' }, options: {} },
  });
  changed = true;
}
if (!workflow.nodes.some((node) => node.name === attachName)) {
  workflow.nodes.push({
    id: randomUUID(), name: attachName, type: 'n8n-nodes-base.code', typeVersion: 2, position: [1500, 80],
    parameters: { mode: 'runOnceForEachItem', jsCode: "const existingId = Number($json.existing_id || 0);\nif (!existingId) throw new Error('existing_id ausente');\nreturn { json: { ...$json, id: existingId } };" },
  });
  changed = true;
}
const expectedParseConnection = { main: [[{ node: ifName, type: 'main', index: 0 }]] };
if (JSON.stringify(workflow.connections['Code - Parse score']) !== JSON.stringify(expectedParseConnection)) {
  workflow.connections['Code - Parse score'] = expectedParseConnection;
  changed = true;
}
const expectedIf = { main: [
  [{ node: attachName, type: 'main', index: 0 }],
  [{ node: 'Supabase - Insert candidata', type: 'main', index: 0 }],
] };
if (JSON.stringify(workflow.connections[ifName]) !== JSON.stringify(expectedIf)) {
  workflow.connections[ifName] = expectedIf;
  changed = true;
}
const expectedAttach = { main: [[{ node: 'Loop Over Items', type: 'main', index: 0 }]] };
if (JSON.stringify(workflow.connections[attachName]) !== JSON.stringify(expectedAttach)) {
  workflow.connections[attachName] = expectedAttach;
  changed = true;
}
if (changed) {
  await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify({
    name: workflow.name, nodes: workflow.nodes, connections: workflow.connections,
    settings: workflow.settings, staticData: workflow.staticData,
  }) });
}
let saved = await api(`/workflows/${workflowId}`);
if (workflow.active && !saved.active) {
  await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
  saved = await api(`/workflows/${workflowId}`);
}
const dedup = saved.nodes.find((node) => node.name === 'Code - Dedup + Top20')?.parameters?.jsCode || '';
if (!saved.active || !dedup.includes('existingByUrl') || !dedup.includes("perfil: 'latam_practical_non_technical'")) throw new Error('scout_reuse_fix_not_persisted');
console.log(JSON.stringify({ ok: true, changed, active: saved.active, reuse_existing_candidates: true, latam_practical_profile: true }, null, 2));
