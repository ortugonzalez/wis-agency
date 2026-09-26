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
const generator = workflow.nodes.find((node) => node.name === 'Generar reflexión para X');
const validator = workflow.nodes.find((node) => node.name === 'Validar reflexión');
if (!generator || !validator) throw new Error('humanizer_nodes_not_found');

const humanizerName = 'Humanizar borrador WIS';
const chooserName = 'Elegir texto WIS';
const alreadyInstalled = workflow.nodes.some((node) => node.name === humanizerName);
if (!alreadyInstalled) {
  const humanizer = {
    id: 'humanize-wis-draft',
    name: humanizerName,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [900, -260],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1000,
    continueOnFail: true,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'content-type', value: 'application/json' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ { model: "gpt-4o-mini", messages: [ { role: "user", content: [
        "Revisá este borrador como una segunda pasada de edición. No lo conviertas en un post viral, un anuncio ni un texto de marketing.",
        "Tiene que sonar como si Ortu se lo contara a su papá o a un amigo: simple, concreto, con palabras comunes y sin frases armadas.",
        "El foco es mostrar el negocio real de WIS: qué hicimos, qué estamos probando, qué error apareció, cuánto tuvimos que revisar, qué decisión tomamos o qué aprendimos.",
        "Conservá las afirmaciones del borrador. No inventes clientes, métricas, resultados, reuniones, datos ni experiencias. No agregues llamados a contratar, preguntas para vender, títulos, ganchos virales, hashtags, emojis ni links.",
        "Quitá fórmulas de IA o folleto, pero no borres los detalles concretos del trabajo. Mantené el voseo y los saltos de línea cuando ayuden. Si se puede decir en menos palabras, recortá: preferimos una charla breve de 350 a 850 caracteres antes que un ensayo.",
        "Devolvé únicamente JSON válido con la forma {\\"post\\":\\"...\\"}.",
        "BORRADOR:", String($(\'Generar reflexión para X\').first().json?.choices?.[0]?.message?.content || ''),
        "FUENTE DISPONIBLE:", JSON.stringify({ source: $(\'Armar consigna editorial\').first().json?.source_name, title: $(\'Armar consigna editorial\').first().json?.title, summary: $(\'Armar consigna editorial\').first().json?.summary })
      ].join(String.fromCharCode(10)) } ], temperature: 0.2 } }`,
      options: { response: { response: { responseFormat: 'json' } } },
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
    },
    credentials: structuredClone(generator.credentials),
  };
  const chooser = {
    id: 'choose-wis-draft',
    name: chooserName,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1140, -260],
    parameters: {
      jsCode: `const humanized = $json?.choices?.[0]?.message?.content;
const original = $('Generar reflexión para X').first().json?.choices?.[0]?.message?.content;
const content = String(humanized || original || '');
return [{ json: { choices: [{ message: { content } }], humanizer_used: Boolean(humanized), humanizer_fallback: !humanized } }];`,
    },
  };
  workflow.nodes.push(humanizer, chooser);
  workflow.connections['Generar reflexión para X'] = { main: [[{ node: humanizerName, type: 'main', index: 0 }]] };
  workflow.connections[humanizerName] = { main: [[{ node: chooserName, type: 'main', index: 0 }]] };
  workflow.connections[chooserName] = { main: [[{ node: 'Validar reflexión', type: 'main', index: 0 }]] };
}

await api(`/workflows/${workflowId}`, {
  method: 'PUT',
  body: JSON.stringify({ name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings, staticData: workflow.staticData }),
});
console.log(JSON.stringify({ ok: true, workflow_id: workflowId, humanizer: alreadyInstalled ? 'already_present' : 'installed', fallback: 'original_draft_if_humanizer_fails', no_publish: true }));
