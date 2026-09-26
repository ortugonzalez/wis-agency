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

const workflowId = '7T4PbznyXXnAO60C';
const workflow = await api(`/workflows/${workflowId}`);
const fallbackName = 'Contexto WIS - Trabajo con empresas';
if (!workflow.nodes.some((node) => node.name === fallbackName)) {
  workflow.nodes.push({
    id: 'wis-business-fallback',
    name: fallbackName,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [760, 220],
    parameters: {
      jsCode: `const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
return [{ json: {
  ok: true,
  date,
  localDate: date,
  source_name: 'WIS - trabajo con empresas',
  title: 'Trabajo cotidiano de WIS con empresas',
  url: 'wis://wis-business/' + date,
  published: new Date().toISOString(),
  summary: 'Contexto real para escribir sobre el trabajo de WIS con empresas y PyMEs: relevar procesos antes de tocar herramientas, detectar tareas repetitivas, ordenar excepciones, integrar sistemas existentes, probar con casos reales, revisar errores de producción y acompañar los ajustes. No inventar clientes, métricas ni resultados.',
  sourceOk: true,
  topicOk: true,
  score: 100,
  wis_context_only: true,
} }];`,
    },
  });
}

const validNode = '¿Hay noticia válida?';
workflow.connections[validNode] = workflow.connections[validNode] || { main: [[], []] };
workflow.connections[validNode].main[1] = [{ node: fallbackName, type: 'main', index: 0 }];
workflow.connections[fallbackName] = { main: [[{ node: 'Armar consigna editorial', type: 'main', index: 0 }]] };

await api(`/workflows/${workflowId}`, {
  method: 'PUT',
  body: JSON.stringify({ name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings, staticData: workflow.staticData }),
});
console.log(JSON.stringify({ ok: true, workflow_id: workflowId, fallback: 'wis_business_context_when_no_news', active_unchanged: true }));
