export const services = [
  {
    slug: 'agentes-ia-para-atencion',
    number: '01',
    name: 'Atención',
    title: 'Agentes de IA para atender mejor, sin sumar otra bandeja.',
    description: 'Diseñamos respuestas con contexto, derivaciones claras y registro automático para que cada consulta tenga un próximo paso.',
    keyword: 'agentes de IA para atención al cliente',
    bullets: ['WhatsApp y canales digitales', 'Derivación a personas con contexto', 'Registro de conversaciones y datos'],
  },
  {
    slug: 'automatizacion-comercial',
    number: '02',
    name: 'Seguimiento',
    title: 'Automatización comercial para que ninguna oportunidad quede a la deriva.',
    description: 'Conectamos consultas, oportunidades y tareas para que el equipo sepa qué hacer después y cuándo hacerlo.',
    keyword: 'automatización comercial para empresas',
    bullets: ['Captura y calificación de oportunidades', 'Seguimientos y recordatorios', 'CRM actualizado sin carga duplicada'],
  },
  {
    slug: 'automatizacion-de-procesos',
    number: '03',
    name: 'Operación',
    title: 'Automatización de procesos para que la información circule.',
    description: 'Mapeamos los puntos donde se corta la operación y construimos sistemas que conectan datos, personas y herramientas.',
    keyword: 'automatización de procesos empresariales',
    bullets: ['Planillas, correos y documentos', 'Integraciones con sistemas existentes', 'Alertas, reglas y trazabilidad'],
  },
  {
    slug: 'integracion-de-sistemas',
    number: '04',
    name: 'Integración',
    title: 'Integración de sistemas para que la información no quede aislada.',
    description: 'Conectamos las herramientas que ya existen en tu empresa para que los datos lleguen al lugar correcto sin duplicar trabajo.',
    keyword: 'integración de sistemas para empresas',
    bullets: ['WhatsApp, CRM y herramientas internas', 'APIs y flujos de datos', 'Trazabilidad entre equipos'],
  },
] as const;

export const cases = ['Administración Pacífico', 'Hotel Bristol', 'QUALITYHARD', 'IMEPHO', 'Movimientos Indumec', 'Metzeler Joyas', 'DUGAS'] as const;

export type SolutionCategory = 'Asistentes' | 'Operación' | 'Sistemas a medida';

export const solutionCategories = ['Todos', 'Asistentes', 'Operación', 'Sistemas a medida'] as const;

export const solutions = [
  {
    slug: 'asistente-virtual-para-pedidos',
    number: '01',
    category: 'Asistentes',
    title: 'Asistente virtual para tomar y recibir pedidos',
    short: 'Un canal público que recibe pedidos, responde consultas y deja la información lista para operar.',
    detail: 'Diseñamos asistentes que entienden el pedido, hacen las preguntas necesarias y derivan al equipo cuando hace falta una decisión humana.',
    examples: ['DUGAS'],
    exampleNote: 'DUGAS: asistente virtual para la toma y recepción de pedidos.',
    tags: ['WhatsApp', 'Pedidos', 'Derivación'],
    demoUrl: null,
  },
  {
    slug: 'asistentes-internos-whatsapp',
    number: '02',
    category: 'Asistentes',
    title: 'Asistentes internos para equipos y grupos de WhatsApp',
    short: 'Consultas internas, comunicación operativa y respuestas con contexto dentro de los canales que el equipo ya usa.',
    detail: 'El asistente trabaja dentro de la operación: consulta información, ordena pedidos internos y ayuda a que el conocimiento no quede perdido en un grupo.',
    examples: ['QUALITYHARD'],
    exampleNote: 'QUALITYHARD: asistente orientado a comunicación y consultas internas.',
    tags: ['Grupos', 'Consultas internas', 'Contexto'],
    demoUrl: null,
  },
  {
    slug: 'digitalizacion-de-documentos',
    number: '03',
    category: 'Operación',
    title: 'Digitalización y lectura de documentos',
    short: 'Convertimos documentos que hoy se revisan a mano en información usable por el equipo y por otros sistemas.',
    detail: 'Extraemos datos, validamos campos y conectamos la información con el circuito que tiene que seguir, sin obligar a cargar todo dos veces.',
    examples: ['IMEPHO'],
    exampleNote: 'IMEPHO: digitalización y orden de documentación operativa.',
    tags: ['Documentos', 'OCR', 'Validación'],
    demoUrl: null,
  },
  {
    slug: 'crm-interno-y-orden-operativo',
    number: '04',
    category: 'Operación',
    title: 'CRM interno y plataforma de orden',
    short: 'Un lugar de trabajo para que el equipo pueda seguir conversaciones, tareas, clientes y próximos pasos.',
    detail: 'Cuando WhatsApp concentra demasiada operación, construimos una capa interna que ordena la información sin perder el canal donde todo empezó.',
    examples: ['Administración Pacífico'],
    exampleNote: 'Administración Pacífico: CRM interno y plataforma de orden vinculada a WhatsApp.',
    tags: ['CRM', 'WhatsApp', 'Tableros'],
    demoUrl: null,
  },
  {
    slug: 'automatizacion-de-extractos-bancarios',
    number: '05',
    category: 'Operación',
    title: 'Automatización de extractos bancarios',
    short: 'Leemos extractos, ordenamos movimientos y llevamos la información al circuito administrativo que corresponde.',
    detail: 'La automatización reduce la carga manual y deja trazabilidad para revisar excepciones, conciliaciones y movimientos que requieren atención.',
    examples: ['Administración Bruno'],
    exampleNote: 'Administración Bruno: automatización de extractos para administración.',
    tags: ['Extractos', 'Administración', 'Trazabilidad'],
    demoUrl: null,
  },
  {
    slug: 'liquidacion-de-sueldos',
    number: '06',
    category: 'Operación',
    title: 'Procesos para liquidación de sueldos',
    short: 'Ordenamos la información previa y repetitiva que interviene en la liquidación para que el proceso sea más claro y controlable.',
    detail: 'Centralizamos novedades, validaciones y documentación para que las personas responsables trabajen sobre información consistente.',
    examples: ['Doña Francisca'],
    exampleNote: 'Doña Francisca: solución para el circuito de liquidación de sueldos de la pesquera.',
    tags: ['Novedades', 'Validaciones', 'Personal'],
    demoUrl: null,
  },
  {
    slug: 'landing-pages-y-sistemas-a-medida',
    number: '07',
    category: 'Sistemas a medida',
    title: 'Landing pages, portales y sistemas a medida',
    short: 'Desde una landing que explica mejor el negocio hasta una plataforma completa para operar un proceso.',
    detail: 'Construimos la capa digital que tu negocio necesita: una landing, un portal, un CRM o un sistema completo conectado a tus herramientas.',
    examples: ['Movimientos Indumec'],
    exampleNote: 'Movimientos Indumec: landing y sistema de gestión en desarrollo.',
    tags: ['Landing', 'Portal', 'Sistema propio'],
    demoUrl: null,
  },
  {
    slug: 'cobranzas-y-recordatorios',
    number: '08',
    category: 'Sistemas a medida',
    title: 'Reclamos de pago y recordatorios',
    short: 'Seguimientos que salen en el momento correcto y llegan con el contexto necesario.',
    detail: 'Automatizamos recordatorios, avisos y tareas de seguimiento, dejando las excepciones y las conversaciones sensibles en manos del equipo.',
    examples: [],
    exampleNote: 'Una solución aplicable a administración, ventas y cuentas corrientes.',
    tags: ['Cobranzas', 'Recordatorios', 'Seguimiento'],
    demoUrl: null,
  },
  {
    slug: 'consultas-de-stock-y-clientes',
    number: '09',
    category: 'Asistentes',
    title: 'Asistentes para stock, clientes y consultas internas',
    short: 'El equipo pregunta en lenguaje natural y recibe información útil sin buscar en cinco sistemas.',
    detail: 'Conectamos la fuente de datos correcta y definimos qué puede responder el asistente, qué debe registrar y cuándo tiene que derivar.',
    examples: [],
    exampleNote: 'Una solución para equipos comerciales y operativos que necesitan consultar información rápido.',
    tags: ['Stock', 'Clientes', 'Base de conocimiento'],
    demoUrl: null,
  },
  {
    slug: 'crm-de-recompra-y-congresos',
    number: '10',
    category: 'Sistemas a medida',
    title: 'CRM de recompra y campañas para hoteles',
    short: 'Volvemos a trabajar los contactos que ya respondieron y los vinculamos con nuevas oportunidades de la ciudad.',
    detail: 'Construimos un CRM que recibe datos nuevos todos los días, identifica contactos con los que ya hubo interacción y permite activar seguimientos relacionados con recompra y congresos próximos.',
    examples: ['Hotel Bristol'],
    exampleNote: 'Hotel Bristol: CRM comercial con datos diarios para recompra y congresos.',
    tags: ['CRM', 'Recompra', 'Congresos', 'Datos diarios'],
    demoUrl: null,
  },
] as const satisfies ReadonlyArray<{
  slug: string;
  number: string;
  category: SolutionCategory;
  title: string;
  short: string;
  detail: string;
  examples: readonly string[];
  exampleNote: string;
  tags: readonly string[];
  demoUrl: string | null;
}>;

export const caseProfiles = [
  { name: 'Administración Pacífico', label: 'CRM interno', summary: 'Una plataforma de orden vinculada a WhatsApp para seguir clientes, tareas y próximos pasos.', before: 'La operación se repartía entre conversaciones de WhatsApp, registros sueltos y seguimientos que dependían de la memoria de cada persona.', after: 'Automatizamos el registro y seguimiento de la operación que empezaba en WhatsApp y construimos una plataforma interna para concentrar clientes, tareas y próximos pasos.', solutionSlug: 'crm-interno-y-orden-operativo', logo: '/cases/administracion-pacifico.png' },
  { name: 'Hotel Bristol', label: 'CRM de recompra y congresos', summary: 'Un CRM comercial que trabaja con datos nuevos todos los días.', before: 'Los contactos que alguna vez habían respondido y las oportunidades vinculadas a congresos próximos no tenían un circuito único para volver a trabajarse de manera sostenida.', after: 'Automatizamos la actualización diaria de datos, la identificación de contactos con historial y la preparación de seguimientos para recompra y congresos. El equipo puede trabajar sobre oportunidades activas sin reconstruir la información desde cero.', solutionSlug: 'crm-de-recompra-y-congresos', logo: null },
  { name: 'IMEPHO', label: 'Digitalización de documentos', summary: 'Información operativa digitalizada y preparada para continuar el circuito.', before: 'El equipo podía dedicar cerca de cuatro horas por día a digitalizar manualmente los archivos que necesitaba procesar. La tarea era repetitiva, consumía tiempo y demoraba el acceso a la información.', after: 'Armamos un circuito que recibe los archivos, extrae la información relevante, la valida y la deja lista para continuar el proceso. El equipo puede enfocarse en revisar lo importante, en lugar de cargar documento por documento.', solutionSlug: 'digitalizacion-de-documentos', logo: '/cases/imepho.webp' },
  { name: 'QUALITYHARD', label: 'Asistente técnico interno', summary: 'Un asistente para consultas e incidentes dentro de la comunicación interna.', before: 'Entre distintos trabajos e incidentes del día a día, muchas consultas quedaban repartidas en grupos y no siempre recibían una respuesta rápida.', after: 'Automatizamos la primera respuesta y la búsqueda de contexto dentro de la comunicación interna. El equipo puede ordenar cada incidente, encontrar información y derivar mejor los casos que requieren intervención.', solutionSlug: 'asistentes-internos-whatsapp', logo: '/cases/qualityhard.png' },
  { name: 'Movimientos Indumec', label: 'Landing y sistema a medida', summary: 'Una presencia digital y una base de gestión para presentar y operar el proyecto.', before: 'La propuesta comercial y la gestión del proyecto necesitaban una base digital unificada para comunicar mejor y ordenar el trabajo.', after: 'Estamos construyendo una landing y un sistema de gestión a medida que conectan la presentación comercial con la operación del proyecto, para que la información no quede repartida entre herramientas.', solutionSlug: 'landing-pages-y-sistemas-a-medida', logo: '/cases/indumec.svg' },
  { name: 'Administración Bruno', label: 'Automatización administrativa', summary: 'Extractos bancarios convertidos en información administrativa más ordenada.', before: 'Cada día se invertía entre una y dos horas por consorcio para descargar extractos bancarios y preparar los movimientos antes de poder revisarlos.', after: 'Automatizamos la descarga y el orden de la información para generar un reporte diario con los movimientos listos para revisar. El equipo recibe una vista más clara y puede concentrarse en las excepciones, en lugar de repetir la misma tarea todos los días.', solutionSlug: 'automatizacion-de-extractos-bancarios', logo: '/cases/administracion-bruno.png' },
  { name: 'Doña Francisca', label: 'Liquidación de sueldos', summary: 'Un circuito más claro para centralizar la información previa a la liquidación.', before: 'Las novedades y la documentación que intervenían en la liquidación estaban dispersas entre personas, mensajes y archivos.', after: 'Ordenamos y automatizamos la recepción, validación y preparación de la información para que el proceso llegue a liquidación con menos fricción y más control.', solutionSlug: 'liquidacion-de-sueldos', logo: '/cases/dona-francesca.png' },
  { name: 'Metzeler Joyas', label: 'E-commerce y gestión interna', summary: 'Pedidos centralizados de Mercado Libre y Tienda Nube, junto con una visión más ordenada de gastos, ingresos y operación diaria.', before: 'Los pedidos de Mercado Libre y Tienda Nube, junto con los gastos e ingresos, se seguían desde registros separados.', after: 'Centralizamos los pedidos de ambos canales y ordenamos la lectura de ingresos, gastos y operación diaria. El negocio puede revisar qué pasó y qué necesita atención desde una misma vista.', solutionSlug: null, logo: '/cases/metzeler-joyas.png' },
  { name: 'DUGAS', label: 'Asistente virtual', summary: 'Un canal público para tomar y recibir pedidos en momentos de alta demanda.', before: 'DUGAS atendía pedidos desde tres líneas de WhatsApp, con tres personas cubriendo la atención durante todos los días. En temporada alta, el volumen podía crecer mucho y la calidad de respuesta no siempre acompañaba la demanda.', after: 'Automatizamos la recepción de pedidos, la recopilación de la información necesaria y la derivación de cada caso. El equipo recibe conversaciones más ordenadas y la atención depende menos de que una persona pueda responder manualmente cada mensaje.', solutionSlug: 'asistente-virtual-para-pedidos', logo: null },
] as const;

export const resources = [
  { slug: 'que-proceso-automatizar-primero', title: 'Cómo saber qué proceso automatizar primero', description: 'Una guía práctica para detectar dónde la automatización puede liberar tiempo sin agregar complejidad.', body: ['La primera automatización no debería ser la más llamativa. Debería ser la que resuelve una fricción frecuente, medible y suficientemente acotada como para aprender rápido.', 'Empezá por observar qué tarea se repite, qué información se copia y dónde una persona tiene que acordarse de hacer algo. Después preguntá qué pasa cuando ese paso se demora o se saltea.', 'Un buen primer proceso tiene un inicio claro, un resultado claro y pocas excepciones. Si no podés explicarlo en una secuencia corta, todavía falta entenderlo antes de automatizarlo.'] },
  { slug: 'automatizacion-de-whatsapp-para-empresas', title: 'Automatización de WhatsApp para empresas', description: 'Qué conviene automatizar, qué debería seguir haciendo una persona y cómo evitar respuestas sin contexto.', body: ['WhatsApp suele ser el lugar donde empieza la operación, pero no debería ser el lugar donde termina. El desafío no es responder más rápido: es que cada conversación deje información útil para el siguiente paso.', 'Conviene automatizar la recepción, la clasificación, las preguntas frecuentes y los recordatorios. Las excepciones, las decisiones sensibles y las conversaciones que necesitan criterio deberían llegar a una persona con contexto.', 'La mejor experiencia no parece un robot. Parece un equipo que responde con orden, sabe qué pasó antes y no vuelve a pedir la misma información.'] },
  { slug: 'conectar-whatsapp-crm-google-sheets', title: 'Cómo conectar WhatsApp, CRM y Google Sheets', description: 'El recorrido de la información cuando una conversación tiene que transformarse en una tarea comercial.', body: ['Una conversación no es todavía una oportunidad. Para que se convierta en trabajo comercial, necesita datos mínimos, un responsable y un próximo paso.', 'La conexión entre WhatsApp, CRM y Google Sheets puede ser simple: capturar lo importante, validar los datos y registrar la acción que sigue. Lo importante es decidir qué sistema tiene la última palabra para cada dato.', 'Cuando el recorrido está definido, el equipo deja de copiar conversaciones y puede dedicar más tiempo a decidir, vender y atender.'] },
  { slug: 'agentes-de-ia-cuando-sirven', title: 'Agentes de IA: cuándo sirven y cuándo no', description: 'Una mirada concreta para decidir si hace falta un agente, una automatización o simplemente ordenar el proceso.', body: ['Un agente de IA sirve cuando tiene que interpretar información, elegir entre caminos y actuar dentro de un proceso con reglas claras. No sirve para tapar una operación que todavía nadie entiende.', 'Si el trabajo es siempre igual, una automatización tradicional puede ser más simple, barata y confiable. Si hay documentos, contexto y decisiones repetitivas, un agente puede aportar valor.', 'La pregunta no es si tu empresa necesita IA. La pregunta es qué parte del trabajo necesita entender, decidir o ejecutar un sistema.'] },
] as const;

export const siteUrl = 'https://wis-agency.com';
