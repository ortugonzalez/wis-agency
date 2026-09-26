import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('C:/Users/Operador/Desktop/Playground/.env', 'utf8')
    .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }),
);
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };
async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text(); let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

const dailyId = '7T4PbznyXXnAO60C';
const daily = await api(`/workflows/${dailyId}`);
const promptNode = daily.nodes.find((node) => node.name === 'Armar consigna editorial');
const validatorNode = daily.nodes.find((node) => node.name === 'Validar reflexión');
const messageNode = daily.nodes.find((node) => node.name === 'Armar mensaje de revisión editorial');
if (!promptNode || !validatorNode || !messageNode) throw new Error('daily_style_nodes_not_found');

promptNode.parameters.jsCode = `
const s = $json;
const prompt = [
  'Escribí una publicación para X en español rioplatense, como si la contara Ortu mostrando el desarrollo real de WIS.',
  'El objetivo es mostrar el trabajo real de WIS con empresas y PyMEs: qué estamos ordenando, probando, revisando o aprendiendo. No vendas servicios, no busques clientes y no cierres con una invitación comercial.',
  'Contexto real permitido sobre WIS: trabajamos con empresas y PyMEs para entender cómo hacen hoy su trabajo, ordenar procesos, detectar tareas repetitivas, contemplar excepciones, integrar las herramientas que ya usan, probar cambios y acompañar los ajustes posteriores. También decidimos qué no conviene automatizar cuando el proceso todavía no está claro.',
  'Elegí un ángulo por publicación: una conversación de trabajo, una decisión sobre un proceso, un error de implementación, una prueba con datos reales, una mejora que llevó varias revisiones o una reflexión sobre lo que aprendimos trabajando con empresas. La noticia del día no es el tema: si no aporta una conexión clara con el trabajo de WIS, ignorala.',
  'El negocio de WIS tiene que ser el protagonista. No hables de cómo estamos armando esta cuenta ni de la automatización de publicaciones. No menciones X, Twitter, Telegram, n8n, bots, redes sociales, posts, tweets ni este flujo, aunque aparezcan en los datos internos.',
  'La primera frase tiene que abrir una tensión concreta o una observación que dé ganas de seguir leyendo, sin clickbait ni títulos artificiales. Empezá como una charla con tu papá o un amigo, pero con una idea que despierte curiosidad.',
  'Contalo en una sola idea: qué pasó o qué problema aparece, qué entendimos y qué puede aprender otra persona que maneja un negocio. No enumeres etapas ni expliques todo el proceso. La publicación tiene que aportar una enseñanza práctica, no solo contar que estamos trabajando.',
  'Priorizá una publicación breve: entre 250 y 450 caracteres cuando la idea lo permita; hasta 700 solo si una historia real necesita más espacio. No alargues por llenar espacio. Nunca superes 1400 caracteres.',
  'Usá párrafos cortos y saltos de línea reales. Soná como un mensaje de WhatsApp bien escrito: casero, directo y conversado, no corporativo, académico ni de manual. Preferí palabras comunes y frases que Ortu usaría de verdad: “la verdad”, “nos pasa que”, “ahí es donde aparece el problema” o “así nomás”, sin meterlas a la fuerza. Evitá repetir estructuras como “antes de / ahí aparecen / por eso”. Usá PyMEs cuando corresponda, no “pequeñas y medianas empresas”. Preferí “vos”, “podés”, “tenés” y “tu negocio”. No inventes clientes, métricas, charlas, resultados ni experiencias personales. Evitá frases de folleto como “la revolución”, “la era digital”, “ventaja competitiva”, “la clave”, “un antes y un después”, “quedarse atrás” y “transformación”.',
  'No uses “La noticia dice...”, “esto significa que...”, “¿querés saber cómo...?”, “¿estás listo para...?” ni llamados a la acción comerciales. No uses hashtags, emojis ni links dentro del post. Devolvé únicamente JSON válido con la forma {"post":"..."}.',
  'No uses hashtags, emojis ni links dentro del post. Devolvé únicamente JSON válido con la forma {"post":"..."}.',
  '', 'FECHA DE TRABAJO:', s.date,
].join('\\n');
return [{ json: { ...s, prompt } }];`;

validatorNode.parameters.jsCode = `
const source = $('Armar consigna editorial').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  const cleaned = String(raw || '').replace(/\\x60\\x60\\x60json\\s*/gi, '').replace(/\\x60\\x60\\x60/g, '').trim();
  const parsed = JSON.parse(cleaned.match(/\\{[\\s\\S]*\\}/)?.[0] || cleaned);
  let post = String(parsed.post || '').replace(/\\\\n/g, '\\n').replace(/\\\\r/g, '').replace(/[^\\S\\r\\n]+/g, ' ').replace(/\\n{3,}/g, '\\n\\n').trim();
  post = post
    .replace(/pequeñas y medianas empresas/gi, 'PyMEs')
    .replace(/\\baquellas\\b/gi, 'esas')
    .replace(/\\bpodrías\\b/gi, 'podés')
    .replace(/\\bpodrias\\b/gi, 'podés')
    .replace(/\\bdeberías\\b/gi, 'tenés que')
    .replace(/\\bdeberias\\b/gi, 'tenés que')
    .replace(/\\bpuedes\\b/gi, 'podés')
    .replace(/\\btienes\\b/gi, 'tenés')
    .replace(/\\butilizar\\b/gi, 'usar')
    .replace(/ventaja competitiva/gi, 'una diferencia concreta')
    .replace(/perder terreno/gi, 'seguir igual mientras otros prueban')
    .replace(/quedarte atrás/gi, 'seguir haciendo todo igual')
    .replace(/estar preparado para el futuro/gi, 'empezar a pensar en esto')
    .replace(/mercado cada vez más exigente/gi, 'día a día')
    .replace(/Hoy se habla de la inteligencia artificial como algo que ya no es del futuro, sino del presente\\.?/gi, 'La IA ya está acá. La pregunta es qué hacemos con eso.')
    .replace(/quedarse al margen puede significar perder oportunidades valiosas/gi, 'si no la probás, podés seguir haciendo a mano tareas que ya se pueden resolver más rápido')
    .replace(/sumarse a esta tendencia puede abrirte puertas que ni imaginabas/gi, 'probar algo concreto puede ahorrarte horas')
    .replace(/optimizar procesos/gi, 'hacer más simple el trabajo de todos los días')
    .replace(/en definitiva/gi, 'al final')
    .replace(/¿Qué estás haciendo para no seguir haciendo todo igual\\?/gi, '¿Qué tarea de tu negocio te gustaría dejar de hacer a mano?')
    .replace(/¿Sabías que la inteligencia artificial puede ser tu mejor aliada en el negocio\\?/gi, '¿La IA ya te está ayudando o todavía la ves como algo lejano?')
    .replace(/¿Sabías que la Inteligencia Artificial puede ser tu mejor aliada para hacer crecer tu negocio\\?/gi, '¿La IA te está dando una mano o todavía la ves como algo lejano?')
    .replace(/Hoy, más que nunca, el uso de herramientas inteligentes puede marcar la diferencia en cómo gestionás tus ventas y atención al cliente\\.?/gi, 'Hoy ya hay herramientas que te pueden dar una mano con las ventas y la atención al cliente.')
    .replace(/esto no es solo un capricho tecnológico; es una oportunidad para hacer más simple el trabajo de todos los días, reducir costos y ofrecer un servicio más personalizado\\.?/gi, 'esto no es para jugar a ser una empresa de tecnología. Es para sacarte tareas repetidas de encima, gastar menos tiempo y atender mejor.')
    .replace(/No adaptarte a estos cambios puede dejarte atrás, mientras que los que sí lo hagan verán su trabajo más eficiente y su clientela más satisfecha\\.?/gi, 'Si no lo probás, vas a seguir haciendo a mano cosas que ya se pueden resolver más rápido. Yo arrancaría por una sola tarea y mediría si realmente te sirve.')
    .replace(/¿Qué pensás, estás listo para dar ese paso\\?/gi, '¿Qué tarea de tu negocio te gustaría dejar de hacer a mano?')
    .replace(/En la última charla que tuve con varios emprendedores, salió a la luz cómo muchos ya están utilizando herramientas de IA para hacer más simple el trabajo de todos los días y mejorar la atención al cliente\\.?/gi, 'Para una PyME, la discusión se vuelve concreta cuando mirás qué tarea repetís todos los días y si una herramienta te puede dar una mano.')
    .replace(/cada día que pasa sin aprovechar estas tecnologías, estás dejando pasar oportunidades de mejorar tu eficiencia y atraer más clientes\\.?/gi, 'no hace falta arrancar con algo enorme: podés probar una tarea y ver si realmente te ahorra tiempo.')
    .replace(/No se trata solo de seguir una moda, sino de adaptarte a un mundo que avanza a pasos agigantados\\.?/gi, 'No se trata de seguir una moda. Se trata de probar algo concreto y ver si te sirve.')
    .replace(/Si no empezás a explorar estas opciones, podés seguir haciendo todo igual en la competencia y perder clientes que buscan soluciones más rápidas y efectivas\\.?/gi, 'Si no empezás a probar, vas a seguir haciendo a mano tareas que ya se pueden resolver más rápido.')
    .replace(/¿Ya pensaste en cómo podés incorporar la IA en tu negocio\\?/gi, '¿Qué tarea de tu negocio te gustaría dejar de hacer a mano?')
    .replace(/¿Sabías que la falta de una estrategia de inteligencia artificial puede dejar a tu negocio en desventaja\\?/gi, '¿Tu PyME ya está probando IA o todavía la ves como algo de las grandes?')
    .replace(/Hoy se habla mucho de la necesidad de que Argentina se ponga las pilas con la IA, pero ¿qué significa eso para vos y tu PyME\\?/gi, 'Se está discutiendo qué estrategia debería tener Argentina con la IA. Para vos, la pregunta es más concreta: ¿qué tarea de tu negocio podría hacerse más simple?')
    .replace(/Si no empezás a considerar cómo la IA puede hacer más simple el trabajo de todos los días, mejorar la atención al cliente o incluso ayudarte a tomar decisiones más informadas, te arriesgás a que tus competidores te pasen de largo\\.?/gi, 'No hace falta arrancar con algo enorme. Podés probarla para sacarte tareas repetidas de encima, atender mejor o tomar decisiones con más información.')
    .replace(/La realidad es que adaptarse a estas nuevas tecnologías puede ser lo que marque la diferencia entre seguir a flote o hundirse\\. No se trata de seguir modas, se trata de sobrevivir y crecer en un entorno cada vez más competitivo\\.?/gi, 'Yo no la veo como una moda. La probaría con una tarea puntual, mediría si ahorro tiempo y recién ahí seguiría.')
    .replace(/¿Te gustaría saber cómo podés empezar a incorporar la IA en tu negocio\\?/gi, '¿Qué tarea de tu negocio te gustaría dejar de hacer a mano?')
    .replace(/marcar la diferencia/gi, 'ayudarte de verdad')
    .replace(/mejor aliada en el negocio/gi, 'una ayuda concreta para tu negocio')
    .replace(/capricho tecnológico/gi, 'jugar a ser una empresa de tecnología')
    .replace(/los que sí lo hagan/gi, 'los negocios que la prueben')
    .replace(/dar ese paso/gi, 'probar algo concreto')
    .replace(/\\btransformación\\b/gi, 'cambio')
    .replace(/\\btransformacion\\b/gi, 'cambio');
  const internalTopic = /\\b(?:n8n|telegram|twitter|bot|bots|tweet|tweets|post|posts|redes sociales)\\b|\\bX\\b/i;
  if (internalTopic.test(post)) {
    post = [
      'Antes de automatizar, en WIS miramos cómo se trabaja hoy.',
      '',
      'Ahí aparecen pasos manuales, excepciones y tareas que nadie había dejado claras.',
      '',
      'Si automatizás un proceso desordenado, no lo solucionás: hacés que el problema avance más rápido.',
      '',
      'Por eso, muchas veces el primer trabajo es ordenar antes de tocar una herramienta.',
    ].join('\\n');
  }
  const inventedCase = /con una PyME que|una PyME que se dedica|una empresa que se dedica|con un cliente|un cliente nos|la próxima semana|la semana que viene|en la última charla|varios emprendedores/i;
  if (inventedCase.test(post)) {
    post = [
      'Antes de automatizar, en WIS miramos cómo se trabaja hoy.',
      '',
      'Ahí aparecen pasos manuales, excepciones y tareas que nadie había dejado claras.',
      '',
      'Si automatizás un proceso desordenado, no lo solucionás: hacés que el problema avance más rápido.',
      '',
      'Por eso, muchas veces el primer trabajo es ordenar antes de tocar una herramienta.',
    ].join('\\n');
  }
  if (post.length > 1400) {
    const sentences = post.match(/[^.!?]+[.!?]+/g) || [];
    let compact = '';
    for (const sentence of sentences) {
      const next = (compact + ' ' + sentence.trim()).trim();
      if (next.length > 1350) break;
      compact = next;
    }
    post = compact || post.slice(0, 1347).replace(/\\s+\\S*$/, '').trim() + '…';
  }
  if (!post || post.length > 1400) throw new Error('texto vacío o supera 1400 caracteres');
  return [{ json: { ...source, draft_text: post, draft_length: post.length, draft_ok: true } }];
} catch (error) {
  return [{ json: { ...source, draft_ok: false, draft_error: String(error.message).slice(0, 300) } }];
}`;
messageNode.parameters.jsCode = messageNode.parameters.jsCode.replace(/\/\\d+}'\)/, "/1400}')");
messageNode.parameters.jsCode = messageNode.parameters.jsCode.replace("'/3500'", "'/1400'").replace("'/280'", "'/1400'");
messageNode.parameters.jsCode = messageNode.parameters.jsCode.replace(/\/1100/g, '/1400');
await api(`/workflows/${dailyId}`, { method: 'PUT', body: JSON.stringify({ name: daily.name, nodes: daily.nodes, connections: daily.connections, settings: daily.settings, staticData: daily.staticData }) });

const dedicatedId = 'VT1s1aTNn4y9BZo0';
const dedicated = await api(`/workflows/${dedicatedId}`);
const regenPrompt = dedicated.nodes.find((node) => node.name === 'Build X Regenerate Prompt');
if (!regenPrompt) throw new Error('dedicated_style_node_not_found');
regenPrompt.parameters.jsCode = regenPrompt.parameters.jsCode
  .replace('Entre 650 y 1100 caracteres, con un máximo absoluto de 3500. No uses emojis ni links.', 'No busques título ni gancho viral. Escribí como un mensaje de WhatsApp bien escrito sobre el trabajo externo de WIS con empresas y PyMEs: qué problema ordenamos, dónde nos trabamos, qué revisamos y qué aprendimos. Usá voseo y frases simples, con una informalidad argentina natural. No armes siempre la misma estructura ni uses palabras de consultora. Trabajá una sola idea, abrí con algo que dé ganas de seguir y dejá una enseñanza útil. Preferí 250-450 caracteres; podés llegar a 700 solo si la historia lo necesita. Sin alargar, emojis ni links.')
  .replace('El usuario quiere compartir experiencias sobre automatización con lenguaje natural.', 'El usuario quiere compartir ideas sobre IA y negocios con un tono casero, argentino y conversado. Usá PyMEs, vos, podés y tenés. Evitá el tono neutro, académico o corporativo.')
  .replace('El usuario quiere compartir ideas sobre IA y negocios con lenguaje natural, claro y atractivo para personas no técnicas.', 'El usuario quiere documentar el desarrollo real de WIS: avances, pruebas, errores, bloqueos y aprendizajes. Usá un tono casero, argentino y conversado. No vendas servicios ni pidas contrataciones.')
  .replace('Devolvé únicamente JSON con la forma {"post":"..."}.', 'La primera línea debe llamar la atención sin clickbait. Devolvé únicamente JSON con la forma {"post":"..."}.');
await api(`/workflows/${dedicatedId}`, { method: 'PUT', body: JSON.stringify({ name: dedicated.name, nodes: dedicated.nodes, connections: dedicated.connections, settings: dedicated.settings, staticData: dedicated.staticData }) });

console.log(JSON.stringify({ ok: true, daily_workflow_id: dailyId, dedicated_workflow_id: dedicatedId, style: 'wis-business-diary-conversational', daily_target: '280-1100', daily_cap: 1400, edit_cap: 3500 }));
