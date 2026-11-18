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

export const cases = ['Quality Hard', 'IMEPHO', 'Movimientos Indumec', 'Metzeler Joyas', 'Dugas'] as const;

export const resources = [
  { slug: 'que-proceso-automatizar-primero', title: 'Cómo saber qué proceso automatizar primero', description: 'Una guía práctica para detectar dónde la automatización puede liberar tiempo sin agregar complejidad.', body: ['La primera automatización no debería ser la más llamativa. Debería ser la que resuelve una fricción frecuente, medible y suficientemente acotada como para aprender rápido.', 'Empezá por observar qué tarea se repite, qué información se copia y dónde una persona tiene que acordarse de hacer algo. Después preguntá qué pasa cuando ese paso se demora o se saltea.', 'Un buen primer proceso tiene un inicio claro, un resultado claro y pocas excepciones. Si no podés explicarlo en una secuencia corta, todavía falta entenderlo antes de automatizarlo.'] },
  { slug: 'automatizacion-de-whatsapp-para-empresas', title: 'Automatización de WhatsApp para empresas', description: 'Qué conviene automatizar, qué debería seguir haciendo una persona y cómo evitar respuestas sin contexto.', body: ['WhatsApp suele ser el lugar donde empieza la operación, pero no debería ser el lugar donde termina. El desafío no es responder más rápido: es que cada conversación deje información útil para el siguiente paso.', 'Conviene automatizar la recepción, la clasificación, las preguntas frecuentes y los recordatorios. Las excepciones, las decisiones sensibles y las conversaciones que necesitan criterio deberían llegar a una persona con contexto.', 'La mejor experiencia no parece un robot. Parece un equipo que responde con orden, sabe qué pasó antes y no vuelve a pedir la misma información.'] },
  { slug: 'conectar-whatsapp-crm-google-sheets', title: 'Cómo conectar WhatsApp, CRM y Google Sheets', description: 'El recorrido de la información cuando una conversación tiene que transformarse en una tarea comercial.', body: ['Una conversación no es todavía una oportunidad. Para que se convierta en trabajo comercial, necesita datos mínimos, un responsable y un próximo paso.', 'La conexión entre WhatsApp, CRM y Google Sheets puede ser simple: capturar lo importante, validar los datos y registrar la acción que sigue. Lo importante es decidir qué sistema tiene la última palabra para cada dato.', 'Cuando el recorrido está definido, el equipo deja de copiar conversaciones y puede dedicar más tiempo a decidir, vender y atender.'] },
  { slug: 'agentes-de-ia-cuando-sirven', title: 'Agentes de IA: cuándo sirven y cuándo no', description: 'Una mirada concreta para decidir si hace falta un agente, una automatización o simplemente ordenar el proceso.', body: ['Un agente de IA sirve cuando tiene que interpretar información, elegir entre caminos y actuar dentro de un proceso con reglas claras. No sirve para tapar una operación que todavía nadie entiende.', 'Si el trabajo es siempre igual, una automatización tradicional puede ser más simple, barata y confiable. Si hay documentos, contexto y decisiones repetitivas, un agente puede aportar valor.', 'La pregunta no es si tu empresa necesita IA. La pregunta es qué parte del trabajo necesita entender, decidir o ejecutar un sistema.'] },
] as const;

export const siteUrl = 'https://wis-agency.com';
