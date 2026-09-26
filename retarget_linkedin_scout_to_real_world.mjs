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

const scoutId = 'um0levNI0wM7FROb';
const writerId = '1ZWaUJr5t3HWFrqa';
const configuredBase = String(env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = raw; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return body;
}

function getNode(workflow, name) {
  const value = workflow.nodes.find((candidate) => candidate.name === name);
  if (!value) throw new Error(`missing_node:${name}`);
  return value;
}

async function save(workflow) {
  const wasActive = Boolean(workflow.active);
  await api(`/workflows/${workflow.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
    }),
  });
  let saved = await api(`/workflows/${workflow.id}`);
  if (wasActive && !saved.active) {
    await api(`/workflows/${workflow.id}/activate`, { method: 'POST', body: '{}' });
    saved = await api(`/workflows/${workflow.id}`);
  }
  if (wasActive && !saved.active) throw new Error(`workflow_inactive:${workflow.id}`);
  return saved;
}

async function tuneScout() {
  const workflow = await api(`/workflows/${scoutId}`);
  const fetch = getNode(workflow, 'Code - Fetch & Parse Fuentes');
  const dedup = getNode(workflow, 'Code - Dedup + Top20');
  const parseScore = getNode(workflow, 'Code - Parse score');

  fetch.parameters.jsCode = String.raw`
function googleNews(query, language, country, edition) {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query)
    + '&hl=' + language + '&gl=' + country + '&ceid=' + edition;
}

const SOURCES = [
  {
    fuente: 'argentina:medidas_publicas',
    url: googleNews('site:argentina.gob.ar ("inteligencia artificial" OR IA) (resolución OR medida OR trabajo OR empleo OR educación OR datos OR trámite) when:60d', 'es-419', 'AR', 'AR:es-419'),
  },
  {
    fuente: 'latam:medidas_publicas',
    url: googleNews('(site:gob.mx OR site:gov.br OR site:gub.uy OR site:gob.cl OR site:gov.co) ("inteligencia artificial" OR IA) (trabajo OR empleo OR educación OR datos OR empresas) when:60d', 'es-419', 'AR', 'AR:es-419'),
  },
  {
    fuente: 'latam:vida_trabajo',
    url: googleNews('(Argentina OR Brasil OR México OR Chile OR Colombia OR Uruguay OR "América Latina") (IA OR "inteligencia artificial") (trabajo OR empleo OR pymes OR bancos OR educación OR privacidad OR trámites OR consumidores) when:30d', 'es-419', 'AR', 'AR:es-419'),
  },
  {
    fuente: 'casos:pymes_es',
    url: googleNews('"inteligencia artificial" (pyme OR pymes OR "pequeña empresa") (caso OR resultados OR fracaso OR ahorro OR productividad) when:30d', 'es-419', 'AR', 'AR:es-419'),
  },
  {
    fuente: 'casos:smb_en',
    url: googleNews('"artificial intelligence" ("small business" OR SME) ("case study" OR results OR failed OR mistakes) when:30d', 'en-US', 'US', 'US:en'),
  },
  {
    fuente: 'datos:trabajo_productividad',
    url: googleNews('AI workers productivity small business survey real results when:21d', 'en-US', 'US', 'US:en'),
  },
  {
    fuente: 'errores:implementacion',
    url: googleNews('AI implementation failed company lessons business case when:30d', 'en-US', 'US', 'US:en'),
  },
  {
    fuente: 'casos:comercio_servicios',
    url: googleNews('AI restaurant retailer professional services small business case results when:30d', 'en-US', 'US', 'US:en'),
  },
  {
    fuente: 'tendencias:personas_empresas',
    url: googleNews('AI adoption people companies measurable trend work customers when:21d', 'en-US', 'US', 'US:en'),
  },
  {
    fuente: 'comparaciones:historia',
    url: googleNews('AI adoption lessons history internet smartphone business comparison when:60d', 'en-US', 'US', 'US:en'),
  },
  {
    fuente: 'latam:casos_reales',
    url: googleNews('(IA OR "inteligencia artificial") empresas Argentina Latinoamérica caso resultados errores when:30d', 'es-419', 'AR', 'AR:es-419'),
  },
];

const CURATED = [
  {
    fuente: 'primaria:bid_latam_productividad_2026',
    url: 'https://www.iadb.org/es/blog/analisis-economico/inteligencia-artificial-motor-de-productividad-o-de-desigualdad',
    titulo: 'En América Latina casi 8 de cada 10 empresas usan IA, pero apenas 6 de cada 100 ven un impacto importante',
    resumen: 'Análisis económico del Banco Interamericano de Desarrollo publicado el 27 de julio de 2026. Cerca del 80% de las empresas de América Latina y el Caribe declara usar herramientas de IA, pero sólo 23% afirma obtener réditos económicos y apenas 6% percibe un impacto significativo. El BID plantea que probar herramientas no alcanza: los resultados aparecen cuando se rediseñan tareas y procesos, se desarrollan capacidades y existen reglas claras.',
    autor: 'Banco Interamericano de Desarrollo',
    publicada_at: '2026-07-27T12:00:00.000Z',
  },
  {
    fuente: 'primaria:argentina_sigen_controles_2026',
    url: 'https://www.argentina.gob.ar/normativa/nacional/norma-426859/texto',
    titulo: 'Argentina aprobó controles obligatorios para los proyectos de IA del Sector Público Nacional',
    resumen: 'La Resolución SIGEN 197/2026, publicada el 22 de junio de 2026, aprobó una guía de controles para las iniciativas de inteligencia artificial de todo el Sector Público Nacional. La medida surgió después de detectar organismos iniciando proyectos sin controles correctamente instrumentados. Exige alinear cada iniciativa con objetivos, normas, integridad, transparencia, seguridad y responsabilidades.',
    autor: 'SIGEN / Argentina.gob.ar',
    publicada_at: '2026-06-22T12:00:00.000Z',
  },
  {
    fuente: 'primaria:argentina_docentes_2026',
    url: 'https://www.argentina.gob.ar/noticias/capacitaran-1600-docentes-en-inteligencia-artificial',
    titulo: 'Argentina anunció capacitación en IA para 1.600 docentes con alcance previsto sobre 144.000 estudiantes',
    resumen: 'La Fundación Sadosky, dependiente de la Secretaría de Innovación, Ciencia y Tecnología, implementará junto con Raspberry Pi el programa Experience AI. La primera etapa incluye universidades nacionales de ocho provincias y busca capacitar a 1.600 docentes para alcanzar a 144.000 estudiantes. El dato permite discutir qué habilidades laborales y educativas se están incorporando cerca de la vida cotidiana.',
    autor: 'Secretaría de Innovación, Ciencia y Tecnología / Fundación Sadosky',
    publicada_at: '2026-06-02T12:00:00.000Z',
  },
  {
    fuente: 'primaria:cepal_latam_conectividad_2026',
    url: 'https://www.cepal.org/es/notas/conectividad-significativa-articulacion-regional-claves-aprovechar-la-inteligencia-artificial',
    titulo: 'CEPAL advierte que muchas empresas latinoamericanas todavía no aprovechan ni las herramientas digitales básicas',
    resumen: 'Nota de CEPAL publicada el 27 de abril de 2026 a partir del Argentina Digital Summit. El organismo señala que muchas empresas de América Latina y el Caribe aún enfrentan restricciones de acceso a servicios digitales básicos. Antes de hablar de sistemas avanzados, la consecuencia práctica está en conectividad, capacitación y capacidad real de incorporar herramientas ya extendidas.',
    autor: 'CEPAL',
    publicada_at: '2026-04-27T12:00:00.000Z',
  },
  {
    fuente: 'primaria:orgvue_error_implementacion',
    url: 'https://www.orgvue.com/news/new-research-exposes-the-complexity-of-deploying-ai-systemsin-the-workforce/',
    titulo: 'El 32% de las organizaciones que despidieron personal esperando ahorrar con IA tuvo que volver a contratar',
    resumen: 'Estudio de Orgvue junto con Watermelon Research sobre 300 responsables de RR.HH. de Estados Unidos. Entre las organizaciones que hicieron recortes por el supuesto ahorro de la IA, 32% tuvo que recontratar. Además, 23% reconoce haber decidido los despidos basándose en supuestos generales sobre la IA y no en un análisis de tareas y roles. El dato no demuestra que la IA no sirva: muestra el costo de automatizar antes de entender el trabajo real.',
    autor: 'Orgvue / Watermelon Research',
    publicada_at: '2026-03-12T12:00:00.000Z',
  },
  {
    fuente: 'primaria:sf_fed_pymes',
    url: 'https://www.frbsf.org/research-and-insights/publications/community-development-research-briefs/2026/07/ai-adoption-in-small-businesses-2024-sbcs/',
    titulo: 'Casi 4 de cada 10 pequeñas empresas ya usan IA o planean hacerlo, pero los frenos siguen siendo tiempo, costo y conocimiento',
    resumen: 'Investigación del Banco de la Reserva Federal de San Francisco basada en la Small Business Credit Survey. Casi 40% de las pequeñas empresas consultadas dijo usar IA o planear hacerlo. Los usos van desde tareas cotidianas y comunicación hasta atención y análisis. Las barreras más repetidas fueron costos, capacitación, tiempo, actualización de sistemas y falta de conocimiento; otras empresas la descartaron por precisión, propiedad intelectual o porque el trato humano es central para su actividad.',
    autor: 'Federal Reserve Bank of San Francisco',
    publicada_at: '2026-07-15T12:00:00.000Z',
  },
  {
    fuente: 'primaria:us_chamber_pymes',
    url: 'https://www.uschamberfoundation.org/workforce/half-of-small-business-workers-use-ai-most-to-boost-productivity-not-automate-jobs',
    titulo: 'La mitad de quienes trabajan en pequeñas empresas ya usa IA, principalmente para producir mejor y no para automatizar puestos',
    resumen: 'Main Street AI Monitor de U.S. Chamber Foundation e Ipsos. Entre quienes usan IA en pequeñas empresas, 64% la aplica a productividad personal, 26% a tareas recurrentes y sólo 6% a procesos con intervención humana mínima. Cuando ahorran tiempo, 59% lo reinvierte en hacer más trabajo o mejorar su calidad. La oportunidad observable aparece en asistir tareas antes que en reemplazar personas.',
    autor: 'U.S. Chamber of Commerce Foundation / Ipsos',
    publicada_at: '2026-06-17T12:00:00.000Z',
  },
  {
    fuente: 'primaria:quickbooks_pymes',
    url: 'https://quickbooks.intuit.com/r/small-business-data/ai-impact-report/',
    titulo: 'Un informe cruza la experiencia de 34.000 dueños con datos de 5,3 millones de PyMEs para medir el impacto real de la IA',
    resumen: 'El AI Impact Report 2026 de QuickBooks combina una encuesta a más de 34.000 dueños de pequeñas y medianas empresas con datos anonimizados de más de 5,3 millones de negocios en Estados Unidos, Canadá, Reino Unido y Australia. Fue desarrollado con economistas de la Universidad de Chicago y observa adopción, uso, productividad, ingresos y crecimiento. Es una fuente para separar percepción de comportamiento medible.',
    autor: 'QuickBooks / University of Chicago',
    publicada_at: '2026-05-13T12:00:00.000Z',
  },
];

function stripCdata(s) { return String(s || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim(); }
function stripTags(s) { return String(s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
function clean(s, max = 1200) { return decodeEntities(stripTags(stripCdata(s))).slice(0, max); }
function extractTag(block, tag) {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp('<' + escaped + '[^>]*>([\\s\\S]*?)<\\/' + escaped + '>', 'i'));
  return match ? match[1] : '';
}
function extractLink(block) {
  let match = block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (match && match[1].trim()) return decodeEntities(match[1].trim());
  match = block.match(/<link[^>]*href="([^"]+)"/i);
  return match ? decodeEntities(match[1].trim()) : '';
}
function parseFeed(xml, source) {
  const items = [];
  const atom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blockTag = atom ? 'entry' : 'item';
  const pattern = new RegExp('<' + blockTag + '[^>]*>([\\s\\S]*?)<\\/' + blockTag + '>', 'gi');
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const block = match[1];
    const titulo = clean(extractTag(block, 'title'), 500);
    const url = extractLink(block);
    if (!titulo || !url) continue;
    const published = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    const parsedDate = published ? new Date(clean(published, 200)) : null;
    const publicada_at = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
    const resumen = clean(extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content'), 1600);
    const autor = clean(extractTag(block, 'dc:creator') || extractTag(block, 'author'), 300);
    items.push({ fuente: source.fuente, url, titulo, resumen, autor, publicada_at });
  }
  return items;
}

const candidatos = [...CURATED];
const warnings = [];
for (const source of SOURCES) {
  try {
    const xml = await this.helpers.httpRequest({
      method: 'GET',
      url: source.url,
      timeout: 20_000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WISRealWorldScout/2.0)' },
    });
    candidatos.push(...parseFeed(String(xml), source));
  } catch (error) {
    warnings.push({ fuente: source.fuente, error: String(error?.message || error).slice(0, 300) });
  }
}

const body = $('Webhook').first().json.body || {};
const runId = String(body.run_id || ('scout-' + Date.now()));
const fecha = String(body.fecha || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()));
const logs = [{
  bot: 'scout', run_id: runId, fecha, paso: 'fetch_fuentes',
  status: warnings.length ? 'warn' : 'ok',
  payload: JSON.stringify({ perfil: 'casos_reales_no_tecnicos', total_crudo: candidatos.length, warnings }),
}];
return [{ json: { run_id: runId, fecha, candidatos, logs } }];`;

  dedup.parameters.jsCode = String.raw`
function trigrams(value) {
  const text = ' ' + String(value || '').toLowerCase().trim() + ' ';
  const grams = new Set();
  for (let index = 0; index < text.length - 2; index += 1) grams.add(text.slice(index, index + 3));
  return grams;
}
function similarity(left, right) {
  const a = trigrams(left), b = trigrams(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const gram of a) if (b.has(gram)) common += 1;
  return (2 * common) / (a.size + b.size);
}
function occurrences(text, terms) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}
function explicitlyAboutAI(candidate) {
  const text = (String(candidate.titulo || '') + ' ' + String(candidate.resumen || '')).toLowerCase();
  return /(^|[^a-z])(ai|ia)([^a-z]|$)|artificial intelligence|inteligencia artificial|generative ai|ia generativa|chatgpt|machine learning|aprendizaje automático/i.test(text);
}
function hasEvidenceSignal(candidate) {
  if (String(candidate.fuente || '').startsWith('primaria:')) return true;
  const title = String(candidate.titulo || '');
  const summary = String(candidate.resumen || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const titleHasFact = /\b\d+(?:[.,]\d+)?%|\b\d+[.]?\d*\s*(?:personas|empresas|trabajadores|docentes|estudiantes|millones|horas|días)|\b(?:ley|resolución|decreto|disposición|reglamento)\s+(?:n[°º]?\s*)?\d+/i.test(title);
  const summaryAddsContext = summary.length >= title.length + 140
    && /\b\d+(?:[.,]\d+)?%|encuest|publicad|resoluci[oó]n|medida|resultado|ahorr|reduj|aument|disminuy/i.test(summary);
  return titleHasFact || summaryAddsContext;
}
function audiencePreScore(candidate) {
  const text = (String(candidate.titulo || '') + ' ' + String(candidate.resumen || '')).toLowerCase();
  const realWorld = ['small business','sme','pyme','pymes','empresa','business owner','trabajador','worker','employee','cliente','customer','restaurant','retail','comercio','survey','encuesta','caso','case study','failed','failure','fracaso','mistake','error','results','resultados','productivity','productividad','hours','horas','revenue','ventas','cost','costos','adoption','adopción'];
  const niche = ['benchmark','leaderboard','weights','parámetros','parameters','api','sdk','tokens','gpu','coding model','open source model','model release','modelo de código'];
  const broad = ['small business','pyme','pymes','empresa','worker','employee','trabajador','empleado','workforce','equipo','survey','encuesta','productivity','productividad','training','capacitación','privacy','privacidad','customer','cliente','cost','costo','time','tiempo'];
  const vertical = ['d2c','return to origin','rto','logistics','logística','coding','programación','developer','desarrollador'];
  const regional = ['argentina','américa latina','latin america','latinoamérica','latam','brasil','brazil','méxico','mexico','chile','colombia','uruguay','paraguay','perú','peru','caribe'];
  const practical = ['trabajo','empleo','salario','educación','docente','estudiante','trámite','impuesto','banco','crédito','privacidad','datos personales','consumidor','estafa','pymes','empresa','cliente','tiempo','costo'];
  const numbers = /\b\d+(?:[.,]\d+)?%|\b\d+\s*(?:hours|horas|days|días|workers|empleados|businesses|empresas)\b/i.test(text) ? 3 : 0;
  const pressRelease = /business wire|pr newswire|globenewswire|press release|comunicado/i.test(text) ? 8 : 0;
  const primarySource = String(candidate.fuente || '').startsWith('primaria:') ? 12 : 0;
  const regionalBonus = occurrences(text, regional) * 7;
  const practicalBonus = occurrences(text, practical) * 4;
  const foreignOnlyPenalty = regionalBonus === 0 && /united states|u\.s\.|europe|china|india/i.test(text) ? 18 : 0;
  return occurrences(text, realWorld) * 2 + occurrences(text, broad) * 3 + regionalBonus + practicalBonus + numbers + primarySource
    - occurrences(text, niche) * 5 - occurrences(text, vertical) * 6 - pressRelease - foreignOnlyPenalty;
}

const PROMPT_HEADER = [
  'Sos el editor de un radar de tendencias para Ortu.',
  '',
  'AUDIENCIA PRINCIPAL:',
  'Personas, trabajadores, profesionales y responsables de empresas de Argentina y América Latina. No saben mucho de IA, no quieren convertirse en especialistas y sólo necesitan entender lo justo para su vida personal o laboral.',
  '',
  'La pregunta central no es "¿qué hay de nuevo en IA?" sino "¿qué cambió cerca de esta persona, cómo puede afectarla y qué necesita saber o hacer?".',
  '',
  'Puntuá de 0 a 10 usando esta ponderación:',
  '- 35% cercanía regional: Argentina primero y luego América Latina.',
  '- 30% utilidad cotidiana o laboral para una persona no técnica.',
  '- 25% evidencia observable: medida pública, caso, encuesta, cifra, resultado o consecuencia concreta.',
  '- 10% capacidad de generar una opinión informada.',
  '',
  'PUNTUÁ ALTO (7-10) cuando haya al menos uno de estos elementos:',
  '- Una PyME, persona o equipo que usó IA y obtuvo un resultado medible.',
  '- Una implementación que falló y permite entender qué se hizo mal.',
  '- Datos sobre horas, costos, ventas, empleo, productividad, errores, adopción o comportamiento.',
  '- Una comparación útil con Internet, redes sociales, smartphones, comercio electrónico u otro cambio pasado.',
  '- Una oportunidad cercana que el lector pueda reconocer sin convertirse en especialista.',
  '- Una historia donde dos personas razonables podrían sacar conclusiones distintas.',
  '- Una ley, resolución, política, trámite o decisión pública de Argentina o LATAM que cambie algo concreto para trabajadores, estudiantes, consumidores o empresas.',
  '- Una advertencia útil sobre privacidad, estafas, empleo, bancos, impuestos, educación o uso cotidiano.',
  '',
  'REGLA DE DESCARTE:',
  'La historia debe tratar explícitamente sobre el uso o impacto de IA. Si la relación con IA es indirecta, inferida o inexistente, asigná 0.',
  'Si al quitar el nombre del modelo o empresa deja de existir la historia, asigná máximo 4 puntos.',
  'Si es un comunicado comercial sin contraste o evidencia independiente, asigná máximo 3 puntos.',
  'Si sólo aplica a una vertical específica (por ejemplo logística D2C, programación o un producto puntual) y la lección no se traslada claramente a por lo menos tres rubros, asigná máximo 5 puntos.',
  'Si ocurre fuera de América Latina y no tiene una comparación o consecuencia directa para la región, asigná máximo 4 puntos.',
  'Si para entender por qué importa hay que conocer modelos, siglas o conceptos técnicos, asigná máximo 3 puntos.',
  'No inventes evidencia a partir de un título. Si el resumen sólo repite el título y no aporta una cifra, medida, muestra o resultado, asigná máximo 3 puntos.',
  '',
  'PUNTUÁ BAJO (0-4):',
  '- Lanzamiento de un modelo, benchmark, API, pesos, parámetros o versión.',
  '- Opinión de un CEO sobre el futuro sin evidencia independiente.',
  '- Funding, alianza o comunicado comercial sin resultados verificables.',
  '- Hype, predicción o contenido patrocinado presentado como caso real.',
  '- Tema que sólo interesa a desarrolladores o seguidores intensivos de IA.',
  '',
  'Devolvé SOLO JSON válido:',
  '{"score":0,"razon":"máximo 25 palabras","tipo":"medida_publica|vida_cotidiana|trabajo|educacion|privacidad|caso_empresa|dato_regional|nicho_tecnico","audiencia":0,"evidencia":0,"cercania_latam":0,"utilidad_practica":0,"tecnicismo":0}',
  '',
  'NOTICIA:',
].join('\n');

const source = $('Code - Fetch & Parse Fuentes').first().json;
const runId = source.run_id;
const fecha = source.fecha;
const candidatos = source.candidatos || [];
const priorLogs = source.logs || [];
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 45);
const allRows = $input.all().map((item) => item.json);
const recientes = allRows.filter((row) => row.fecha && new Date(row.fecha) >= cutoff);
const usadas = recientes.filter((row) => row.seleccionada || row.procesada);
const existingByUrl = new Map(allRows.filter((row) => row.url).map((row) => [row.url, row]));
const seenUrls = new Set(usadas.map((row) => row.url));
const seenBatch = new Set();
const survivors = [];

for (const candidate of candidatos) {
  if (!candidate.url || !candidate.titulo || seenUrls.has(candidate.url) || seenBatch.has(candidate.url)) continue;
  if (!explicitlyAboutAI(candidate)) continue;
  if (!hasEvidenceSignal(candidate)) continue;
  if (usadas.some((row) => similarity(row.titulo, candidate.titulo) > 0.88)) continue;
  seenBatch.add(candidate.url);
  const existing = existingByUrl.get(candidate.url);
  survivors.push({ ...candidate, existing_id: existing?.id || null, evidence_signal: true, audience_pre_score: audiencePreScore(candidate) });
}

survivors.sort((left, right) => {
  if (right.audience_pre_score !== left.audience_pre_score) return right.audience_pre_score - left.audience_pre_score;
  return new Date(right.publicada_at || 0) - new Date(left.publicada_at || 0);
});
const top = survivors.slice(0, 24);
const logs = [...priorLogs, {
  bot: 'scout', run_id: runId, fecha, paso: 'audience_prefilter', status: 'ok',
  payload: JSON.stringify({ recientes: recientes.length, usadas: usadas.length, reutilizables: top.filter((item) => item.existing_id).length, sobrevivientes: survivors.length, evaluadas: top.length, perfil: 'latam_practical_non_technical' }),
}];

if (!top.length) return [{ json: { run_id: runId, fecha, logs, empty: true } }];
return top.map((candidate) => ({ json: {
  run_id: runId, fecha, logs, empty: false, ...candidate,
  prompt: PROMPT_HEADER + '\nTítulo: ' + candidate.titulo + '\nFuente: ' + candidate.fuente
    + '\nPublicada: ' + candidate.publicada_at + '\nResumen: ' + candidate.resumen,
} }));`;

  parseScore.parameters.jsCode = String.raw`
let parsed = {};
try {
  const raw = $json.choices?.[0]?.message?.content || $json.message?.content || $json.text || $json.content || JSON.stringify($json);
  const match = String(raw).match(/\{[\s\S]*\}/);
  parsed = JSON.parse(match ? match[0] : raw);
} catch (error) {
  parsed = { score: 0, razon: 'error de parseo: ' + String(error.message || error), tipo: 'nicho_tecnico' };
}
let score = Math.max(0, Math.min(10, Number(parsed.score) || 0));
if (!$('Code - Dedup + Top20').item.json.evidence_signal) score = Math.min(score, 3);
return { json: {
  ...$('Code - Dedup + Top20').item.json,
  score,
  score_razon: String(parsed.razon || '').slice(0, 220),
  score_tipo: String(parsed.tipo || 'sin_clasificar'),
  score_audiencia: Number(parsed.audiencia) || 0,
  score_evidencia: Number(parsed.evidencia) || 0,
  score_aplicabilidad: Number(parsed.utilidad_practica || parsed.aplicabilidad) || 0,
  score_cercania_latam: Number(parsed.cercania_latam) || 0,
  score_tecnicismo: Number(parsed.tecnicismo) || 0,
} };`;

  return save(workflow);
}

async function tuneWriter() {
  const workflow = await api(`/workflows/${writerId}`);
  const build = getNode(workflow, 'Build Prompt');
  const callOpenAI = getNode(workflow, 'Call OpenAI');
  const parseResponse = getNode(workflow, 'Parse LLM Response');
  build.parameters.jsCode = String.raw`
const noticia = $('Get Noticia').first().json || {};
const fewShot = ($('Get Few-Shot Corpus').all() || []).map((item) => item.json.texto).join('\n---\n');
const runId = $('Webhook - Writer Run').first().json.body.run_id;
const noticiaId = $('Webhook - Writer Run').first().json.body.noticia_id;
const rules = [
  'ROL: explicás cambios cercanos a personas de Argentina y América Latina que no saben mucho de IA ni quieren estudiar tecnología.',
  '- La tecnología nunca es el tema principal. El tema es la consecuencia concreta sobre trabajo, dinero, tiempo, trámites, educación, privacidad, clientes o decisiones.',
  '- Abrí con qué cambió o con el dato que afecta al lector. No abras con el nombre de una herramienta, modelo o empresa tecnológica.',
  '- En las primeras tres líneas respondé: qué pasó, dónde pasó y por qué podría importarle a alguien de Argentina o LATAM.',
  '- Si es una medida política o normativa, explicá en palabras comunes a quién alcanza, qué exige o habilita y desde cuándo. No hagas partidismo ni propaganda.',
  '- Cerrá con una acción, criterio o pregunta que el lector pueda llevar a su trabajo o vida esa misma semana.',
  '- El post debe permitir que el lector vea algo de su realidad, reconozca una situación, compare o forme una opinión.',
  '- La noticia tiene que incluir un caso, dato, resultado, error, cambio de hábito o paralelo histórico. Usalo como columna vertebral.',
  '- Abrí con el conflicto o el dato concreto en una frase de hasta 100 caracteres. Después explicá qué pasó y qué tendencia más grande muestra.',
  '- Si aparece un término técnico, explicalo en una frase simple o eliminálo si no es necesario.',
  '- No enumeres modelos, benchmarks, APIs ni características de producto.',
  '- No evangelices sobre IA y no asumas que el lector quiere usarla.',
  '- Voz: 70% Ortu —directa, rioplatense, curiosa, con criterio y usando "vos"—; 30% recursos de engagement —gancho honesto, progresión y pregunta abierta—.',
  '- Entre 600 y 950 caracteres para el cuerpo, sin contar la cita que agrega el sistema. Antes de responder, contalos y reescribí si superás 950. Párrafos naturales de una a tres oraciones.',
  '- Separá el dato de la interpretación: qué sabemos, qué sugiere y qué todavía no demuestra.',
  '- Todo número o afirmación central debe quedar respaldado dentro del post: nombrá la organización, el tipo de investigación y la muestra o alcance cuando estén disponibles.',
  '- No escribas enlaces ni una línea "Fuente:". El sistema agregará automáticamente la cita verificada al final.',
  '- Elegí una sola interpretación filosa y desarrollala. No agregues tres conclusiones parecidas ni una moraleja general sobre la tecnología.',
  '- Escribí como alguien que vio un patrón y lo quiere discutir, no como un periodista que resume un informe ni como un capacitador que da una lección.',
  '- No vendas WIS, no ofrezcas servicios y no conviertas todo en ventas, atención al cliente o reducción de costos.',
  '- Usá una sola pregunta en todo el post: una pregunta final concreta sobre una decisión, tensión o experiencia reconocible; nunca "¿alguna vez...?".',
  '- Evitá por completo estas fórmulas y variantes: "Recientemente", "un estudio reciente", "un estudio reveló", "este dato nos muestra", "qué nos dice esto", "la tendencia es clara", "la tendencia muestra", "es un recordatorio", "en un mundo donde", "es fundamental", "tecnología poderosa", "solución mágica", "análisis profundo", "tomarse el tiempo necesario", "saltar al tren", "¿alguna vez...?”.',
  '- No des una moraleja obvia. Marcá una tensión concreta y dejá espacio para que el lector saque su conclusión.',
  '- Sin emojis, HTML, hashtags forzados ni frases de falsa viralidad.',
].join('\n');
const prompt = [
  'Sos el redactor de LinkedIn de Ortu (Octavio González).',
  rules,
  '',
  'ARTÍCULO SELECCIONADO:',
  'Título: ' + (noticia.titulo || ''),
  'Fuente: ' + (noticia.fuente || ''),
  'Resumen: ' + (noticia.resumen || ''),
  'Razón de selección: ' + (noticia.score_razon || ''),
  '',
  'MUESTRAS REALES DE VOZ:', fewShot,
  '',
  'Escribí un único post y devolvé sólo JSON válido:',
  '{"post":"...","hook_char_count":0,"total_char_count":0,"checklist_ok":true,"razonamiento_breve":"..."}',
].join('\n');
const sourceProfiles = {
  'primaria:bid_latam_productividad_2026': ['Banco Interamericano de Desarrollo', 'análisis económico sobre productividad en América Latina y el Caribe, publicado el 27/07/2026.'],
  'primaria:argentina_sigen_controles_2026': ['SIGEN / Boletín Oficial de la República Argentina', 'Resolución 197/2026, publicada el 22/06/2026.'],
  'primaria:argentina_docentes_2026': ['Secretaría de Innovación, Ciencia y Tecnología / Fundación Sadosky', 'programa para 1.600 docentes y 144.000 estudiantes, anunciado el 02/06/2026.'],
  'primaria:cepal_latam_conectividad_2026': ['CEPAL', 'nota sobre conectividad y adopción empresarial en América Latina, publicada el 27/04/2026.'],
  'primaria:orgvue_error_implementacion': ['Orgvue / Watermelon Research', 'encuesta a 300 responsables de RR.HH. de EE.UU., publicada el 12/03/2026.'],
  'primaria:sf_fed_pymes': ['Federal Reserve Bank of San Francisco', 'análisis del Small Business Credit Survey, publicado el 15/07/2026.'],
  'primaria:us_chamber_pymes': ['U.S. Chamber of Commerce Foundation / Ipsos', 'Main Street AI Monitor sobre trabajadores de pequeñas empresas, publicado el 17/06/2026.'],
  'primaria:quickbooks_pymes': ['QuickBooks / University of Chicago', 'informe basado en 34.000 dueños y datos de 5,3 millones de negocios, publicado el 13/05/2026.'],
};
const fallbackDate = noticia.publicada_at ? new Date(noticia.publicada_at).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'fecha disponible en el artículo';
const titlePublisher = String(noticia.titulo || '').split(/\s+-\s+/).at(-1)?.trim();
const fallbackPublisher = noticia.autor || (titlePublisher && titlePublisher !== noticia.titulo ? titlePublisher : '') || noticia.fuente || 'Artículo original';
const sourceProfile = sourceProfiles[noticia.fuente] || [fallbackPublisher, 'publicado el ' + fallbackDate + '.'];
const citationLine = 'Fuente: ' + sourceProfile[0] + ' — ' + sourceProfile[1] + ' ' + (noticia.url || '');
return [{ json: { prompt, run_id: runId, noticia_id: noticiaId, noticia_titulo: noticia.titulo, noticia_url: noticia.url, citation_line: citationLine } }];`;
  callOpenAI.parameters.jsonBody = '={{ { model: "gpt-4o", messages: [ { role: "user", content: $json.prompt } ], temperature: 0.4, response_format: { type: "json_object" } } }}';
  parseResponse.parameters.jsCode = String.raw`
const prev = $('Build Prompt').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('respuesta vacía');
  const cleaned = raw.replace(/\x60\x60\x60json\s*/gi, '').replace(/\x60\x60\x60/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  if (typeof parsed.post !== 'string' || !parsed.post.trim()) throw new Error('campo post ausente');
  let bodyPost = parsed.post.trim()
    .replace(/\n+Fuente:[\s\S]*$/i, '')
    .replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .trim();
  // Los modelos a veces agregan una pregunta retórica intermedia aunque se les
  // pida una sola. Conservamos la pregunta final y quitamos las anteriores: así
  // el texto queda más directo sin cancelar toda la corrida.
  const questionMatches = [...bodyPost.matchAll(/¿[^?]*\?/g)];
  if (questionMatches.length > 1) {
    let seenQuestions = 0;
    bodyPost = bodyPost.replace(/¿[^?]*\?/g, (question) => {
      seenQuestions += 1;
      return seenQuestions === questionMatches.length ? question : '';
    }).replace(/[ \t]{2,}/g, ' ').replace(/\n[ \t]+/g, '\n').trim();
  }
  bodyPost = bodyPost.replace(/(^|[.!]\s+|\n+)(?:Porque|Que)\s+([a-záéíóúñ])/g,
    (_, prefix, firstLetter) => prefix + firstLetter.toUpperCase());
  // Si el modelo se excede, recortamos conclusiones completas antes de la
  // pregunta final. Nunca cortamos palabras ni la cita y mantenemos al menos
  // 600 caracteres de cuerpo.
  if (bodyPost.length > 950) {
    const finalQuestionMatch = bodyPost.match(/¿[^?]*\?\s*$/);
    const finalQuestion = finalQuestionMatch?.[0]?.trim() || '';
    let prose = finalQuestionMatch ? bodyPost.slice(0, finalQuestionMatch.index).trim() : bodyPost;
    const sentences = prose.match(/[\s\S]*?[.!](?=\s|$)/g) || [prose];
    while (sentences.length > 1) {
      const candidateProse = sentences.slice(0, -1).join('').trim();
      const candidate = (candidateProse + (finalQuestion ? '\n\n' + finalQuestion : '')).trim();
      if (candidate.length < 600) break;
      sentences.pop();
      prose = candidateProse;
      bodyPost = candidate;
      if (bodyPost.length <= 950) break;
    }
  }
  const finalPost = bodyPost + '\n\n' + String(prev.citation_line || '').trim();
  const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(finalPost);
  const hasMarkup = /<[^>]+>/i.test(finalPost);
  const urls = finalPost.match(/https?:\/\/[^\s]+/g) || [];
  const cleanUrl = (value) => String(value || '').replace(/[).,;!?]+$/, '');
  const validCitation = /(^|\n)Fuente:/i.test(finalPost)
    && urls.length === 1
    && cleanUrl(urls[0]) === cleanUrl(prev.noticia_url);
  const questionCount = (finalPost.match(/¿/g) || []).length;
  const genericStyle = /\brecientemente\b|\bun estudio(?: [^.!?\n]{0,45})? revel[óo]\b|\bqu[eé] nos dice esto\b|\bla tendencia (?:que surge |es )?clara\b|\bla tendencia muestra\b|\bes un recordatorio\b|\ben un mundo donde\b|\bes fundamental\b|\btecnología poderosa\b|\bsoluci[oó]n m[aá]gica\b|\bsaltar al tren\b|¿alguna vez/i.test(finalPost);
  // El rango editorial aplica al cuerpo. La cita puede contener una URL larga de
  // Google News y no debe convertir un texto correcto en un falso negativo.
  if (bodyPost.length < 600 || bodyPost.length > 950) throw new Error('cuerpo fuera de 600-950 caracteres');
  // LinkedIn admite hasta 3.000 caracteres; este límite protege también el envío
  // posterior por Telegram sin mezclarlo con el criterio de concisión editorial.
  if (finalPost.length > 3000) throw new Error('post completo supera 3000 caracteres');
  if (hasEmoji || hasMarkup) throw new Error('el post contiene emoji o HTML');
  if (!validCitation) throw new Error('falta la cita validada con la única URL original');
  if (questionCount !== 1) throw new Error('el post debe contener exactamente una pregunta');
  if (genericStyle) throw new Error('el post contiene una muletilla editorial genérica');
  parsed.post = finalPost;
  return [{ json: { ...parsed, parse_ok: true, run_id: prev.run_id, noticia_id: prev.noticia_id, noticia_titulo: prev.noticia_titulo, noticia_url: prev.noticia_url } }];
} catch (error) {
  return [{ json: { parse_ok: false, ok: false, error: 'llm_output_invalid', detail: error.message, run_id: prev.run_id, noticia_id: prev.noticia_id } }];
}`;
  return save(workflow);
}

const scout = await tuneScout();
const writer = await tuneWriter();
console.log(JSON.stringify({
  ok: true,
  scout_active: scout.active,
  writer_active: writer.active,
  audience: 'PyMEs, responsables, profesionales y marcas personales no técnicas',
  source_profile: 'casos, errores, datos, comparaciones y oportunidades visibles',
  model_release_cap: 4,
}, null, 2));
