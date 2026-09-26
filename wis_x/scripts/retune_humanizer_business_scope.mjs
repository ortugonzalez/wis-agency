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
const node = workflow.nodes.find((item) => item.name === 'Humanizar borrador WIS');
if (!node) throw new Error('humanizer_node_not_found');
node.parameters.jsonBody = `={{ { model: "gpt-4o-mini", messages: [ { role: "user", content: [
  "Revisá este borrador como una segunda pasada de edición. No lo conviertas en un post viral, un anuncio ni un texto de marketing.",
  "Tiene que sonar como si Ortu se lo contara a su papá o a un amigo: simple, concreto, con palabras comunes y sin frases armadas. Pensá en un mensaje de WhatsApp bien escrito, no en una publicación de consultora.",
  "El foco es el trabajo externo de WIS con empresas y PyMEs: entender procesos, ordenar tareas, detectar repeticiones y excepciones, integrar herramientas existentes, probar cambios, revisar errores de producción y acompañar ajustes.",
  "No hables de X, Twitter, Telegram, n8n, bots, redes sociales, publicaciones ni de este flujo. Si el borrador se fue para ese lado, reemplazá ese enfoque por el trabajo con empresas que sí esté respaldado por el contexto.",
  "Conservá las afirmaciones válidas y no inventes clientes, rubros, métricas, resultados, reuniones, fechas, planes futuros, datos ni experiencias. Si no hay un caso concreto proporcionado, hablá en general de cómo trabajamos. No agregues llamados a contratar ni preguntas para vender.",
  "Quitá fórmulas de IA o folleto. No armes siempre la estructura “antes de / ahí aparecen / por eso”. Evitá palabras como implementación, optimizar, solución, transformación, observación o proceso cuando se pueda decir algo más simple. Usá frases que Ortu diría de verdad, como “la verdad”, “nos pasa que”, “ahí es donde aparece el problema” o “así nomás”, pero sin meterlas a la fuerza. Mantené el voseo y la informalidad argentina, sin errores ortográficos deliberados. Trabajá una sola idea, abrí con algo que dé ganas de seguir y dejá una enseñanza útil para quien lleva un negocio. Si se puede decir en menos palabras, recortá y priorizá entre 250 y 600 caracteres.",
  "Devolvé únicamente JSON válido con la forma {\\"post\\":\\"...\\"}.",
  "BORRADOR:", String($(\'Generar reflexión para X\').first().json?.choices?.[0]?.message?.content || ''),
  "CONTEXTO DE TRABAJO:", "WIS acompaña a empresas y PyMEs a ordenar procesos antes y durante una implementación. No inventes un caso específico."
].join(String.fromCharCode(10)) } ], temperature: 0.2 } }`;
await api(`/workflows/${workflowId}`, {
  method: 'PUT',
  body: JSON.stringify({ name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings, staticData: workflow.staticData }),
});
console.log(JSON.stringify({ ok: true, workflow_id: workflowId, node: node.name, scope: 'external_wis_business_only' }));
