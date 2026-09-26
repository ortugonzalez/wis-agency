import { finding, scenario, walk } from './core.mjs';

const TYPE_RULES = new Set(['baseline', 'n8n', 'https', 'encoding', 'script', 'http', 'browser', 'bot']);

export function selectedRules(target) {
  return [...new Set([...(target.rules || []), 'baseline'])].filter((rule) => TYPE_RULES.has(rule));
}

export function auditTargetContract(target) {
  const findings = [];
  if (!target?.type) findings.push(finding({ rule: 'baseline.target_type', title: 'El objetivo no declara un tipo', category: 'configuration', severity: 'high', expected: 'Un tipo soportado o unknown', observed: 'type ausente', recommendation: 'Declarar type antes de ejecutar pruebas.' }));
  if (!target?.name) findings.push(finding({ rule: 'baseline.target_name', title: 'El objetivo no tiene nombre', category: 'configuration', severity: 'low', expected: 'Nombre identificable', observed: 'name ausente', recommendation: 'Agregar un nombre para correlacionar reportes.' }));
  if (!target?.source) findings.push(finding({ rule: 'baseline.target_source', title: 'El objetivo no tiene fuente', category: 'configuration', severity: 'high', expected: 'exportPath, baseUrl o entrypoint', observed: 'source ausente', recommendation: 'Configurar una fuente explícita.' }));
  if (target?.type === 'unknown') findings.push(finding({ rule: 'baseline.unsupported_target', title: 'Objetivo sin adaptador específico', category: 'capability', severity: 'info', expected: 'Adaptador conocido o auditoría estática', observed: 'unknown', recommendation: 'Agregar un paquete de reglas o contract para habilitar ejecución segura.' }));
  return findings;
}

export function auditHttpsUrl(url, { mode = 'local', location = '$.source.baseUrl' } = {}) {
  if (!url) return [];
  if (/^\s*=\s*\{\{[\s\S]*\}\}\s*$/.test(String(url))) {
    return [finding({ rule: 'https.dynamic_url_unverified', title: 'URL dinámica no verificable en auditoría estática', category: 'https', severity: 'info', expected: 'La variable resuelve a HTTPS en staging', observed: String(url), recommendation: 'Verificar el valor resuelto de la variable en staging.', location })];
  }
  let parsed;
  try { parsed = new URL(url); } catch {
    return [finding({ rule: 'https.valid_url', title: 'URL inválida', category: 'https', severity: 'high', expected: 'URL absoluta válida', observed: url, recommendation: 'Usar una URL con esquema y hostname válidos.', location })];
  }
  const findings = [];
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (mode !== 'local' && !local && parsed.protocol !== 'https:') findings.push(finding({ rule: 'https.required', title: 'El endpoint no usa HTTPS', category: 'https', severity: 'high', expected: 'https:// fuera de local', observed: url, recommendation: 'Publicar el endpoint con TLS válido.', location }));
  if (parsed.username || parsed.password) findings.push(finding({ rule: 'https.credentials_in_url', title: 'La URL contiene credenciales', category: 'security', severity: 'critical', expected: 'Credenciales en secret manager o headers seguros', observed: `${parsed.protocol}//${parsed.host}${parsed.pathname}`, recommendation: 'Eliminar usuario y contraseña de la URL.', location }));
  return findings;
}

function nodeJsonText(node) {
  try { return JSON.stringify(node); } catch { return ''; }
}

function getNodeConnections(workflow) {
  const outgoing = new Map();
  const incoming = new Map();
  for (const [source, groups] of Object.entries(workflow.connections || {})) {
    const targets = [];
    for (const group of Object.values(groups || {})) {
      for (const branch of group || []) for (const link of branch || []) if (link?.node) targets.push(link.node);
    }
    outgoing.set(source, targets);
    for (const target of targets) incoming.set(target, (incoming.get(target) || 0) + 1);
  }
  return { outgoing, incoming };
}

export function auditN8nWorkflow(workflow, target, index = 0) {
  const findings = [];
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  const names = new Set(nodes.map((node) => node.name));
  const workflowText = nodeJsonText(workflow);
  const hasAuthGuard = /x-bot-secret|authorized|AUTHORIZED_TELEGRAM|authorization/i.test(workflowText);
  const location = `workflows[${index}]`;
  const { outgoing, incoming } = getNodeConnections(workflow || {});
  const roots = nodes.filter((node) => /Trigger$|Webhook|scheduleTrigger|manualTrigger/i.test(`${node.type} ${node.name}`));

  if (!nodes.length) findings.push(finding({ rule: 'n8n.nodes_required', title: 'Workflow sin nodos', category: 'n8n', severity: 'high', expected: 'Al menos un nodo conectado', observed: 'nodes vacío', recommendation: 'Revisar el export JSON.', location }));
  if (workflow?.active === true && (target.environment || 'local') === 'local') findings.push(finding({ rule: 'n8n.local_active', title: 'Workflow activo en auditoría local', category: 'safety', severity: 'medium', expected: 'Export inactivo para pruebas locales', observed: 'active=true', recommendation: 'Desactivar el workflow o auditar una copia.', location }));

  for (const [nodeIndex, node] of nodes.entries()) {
    const nodeLocation = `${location}.nodes[${nodeIndex}](${node.name || node.id || 'unnamed'})`;
    const text = nodeJsonText(node);
    if (/webhook/i.test(node.type || '') || /webhook/i.test(node.name || '')) {
      const auth = node.parameters?.authentication;
      if (target.contract?.requireExplicitWebhookAuth !== false && !auth) findings.push(finding({ rule: hasAuthGuard ? 'n8n.webhook_auth_review' : 'n8n.webhook_auth', title: hasAuthGuard ? 'Webhook requiere verificar su guard de autenticación' : 'Webhook sin autenticación explícita', category: 'security', severity: hasAuthGuard ? 'info' : 'high', expected: 'Autenticación configurada o guard validado', observed: hasAuthGuard ? 'Guard detectado en el workflow, no en el nodo webhook' : 'authentication ausente', recommendation: hasAuthGuard ? 'Confirmar con una prueba negativa que una llamada no autorizada sea rechazada.' : 'Configurar header/auth básica o declarar el webhook como público de forma explícita.', location: nodeLocation }));
      if (!node.parameters?.responseMode) findings.push(finding({ rule: 'n8n.webhook_response', title: 'Webhook sin responseMode explícito', category: 'reliability', severity: 'medium', expected: 'Respuesta inmediata o responseNode declarada', observed: 'responseMode ausente', recommendation: 'Definir cómo y cuándo responder al cliente.', location: nodeLocation }));
    }
    if (/httpRequest/i.test(node.type || '') || /HTTP Request/i.test(node.name || '')) {
      const url = String(node.parameters?.url || '');
      findings.push(...auditHttpsUrl(url, { mode: target.environment || 'local', location: `${nodeLocation}.parameters.url` }));
      if (!node.parameters?.options?.timeout && !node.parameters?.timeout) findings.push(finding({ rule: 'n8n.http_timeout', title: 'HTTP Request sin timeout explícito', category: 'reliability', severity: 'medium', expected: 'Timeout acotado', observed: 'timeout ausente', recommendation: 'Configurar timeout y estrategia de reintento.', location: nodeLocation }));
      if (/(select=\*|limit=|page|offset|cursor|\/items)/i.test(`${url} ${text}`) && /pagination/i.test(text) === false && /page|offset|limit|next|cursor/i.test(url) === false) findings.push(finding({ rule: 'n8n.pagination_review', title: 'HTTP Request requiere revisión de paginación', category: 'data_integrity', severity: 'info', expected: 'Paginación explícita cuando la API devuelve colecciones', observed: 'No se detectó configuración de paginación', recommendation: 'Confirmar que el endpoint no devuelve más de una página.', location: nodeLocation }));
    }
    if (node.type === 'n8n-nodes-base.code' || /Code/i.test(node.name || '')) {
      const code = String(node.parameters?.jsCode || '');
      if (/(child_process|execSync|spawn|process\.env|fs\.)/.test(code)) findings.push(finding({ rule: 'n8n.code_runtime_access', title: 'Code node accede a runtime o filesystem', category: 'security', severity: /child_process|execSync|spawn|fs\./.test(code) ? 'high' : 'medium', expected: 'Código limitado y explícitamente autorizado', observed: 'Se detectó acceso a runtime', recommendation: 'Revisar permisos, entradas y aislamiento del Code node.', location: nodeLocation }));
      if (/try\s*\{/.test(code) === false && /fetch|axios|http|supabase/i.test(code)) findings.push(finding({ rule: 'n8n.code_error_handling', title: 'Code node con IO sin manejo visible de errores', category: 'reliability', severity: 'medium', expected: 'Errores controlados y trazables', observed: 'No se detectó try/catch', recommendation: 'Controlar errores y devolver un estado explícito.', location: nodeLocation }));
    }
    if (node.continueOnFail === true || node.parameters?.continueOnFail === true || node.onError === 'continueRegularOutput') findings.push(finding({ rule: 'n8n.continue_on_fail', title: 'El nodo puede continuar después de un error', category: 'reliability', severity: 'high', expected: 'Error explícito o ruta de recuperación', observed: 'continueOnFail habilitado', recommendation: 'Agregar una ruta de error o verificar el resultado antes de continuar.', location: nodeLocation }));
    walk(node.parameters || {}, (value, childLocation) => {
      if (typeof value !== 'string' || !value.trim()) return;
      if (/^(token|secret|password|authorization|apiKey|api_key)$/i.test(childLocation.split('.').pop() || '') && !value.includes('$env') && !value.includes('$credentials')) findings.push(finding({ rule: 'n8n.inline_secret', title: 'Posible secreto embebido en parámetros', category: 'security', severity: 'critical', expected: 'Referencia a credencial o variable segura', observed: '[valor redactado]', recommendation: 'Mover el secreto a Credentials o variables protegidas.', location: `${nodeLocation}.${childLocation}` }));
    });
    if (/https?:\/\//i.test(text)) {
      const urls = text.match(/https?:\/\/[^"'\s}]+/gi) || [];
      for (const url of urls) findings.push(...auditHttpsUrl(url, { mode: target.environment || 'local', location: nodeLocation }));
    }
  }

  const reachable = new Set(roots.map((node) => node.name));
  const queue = [...reachable];
  while (queue.length) for (const next of outgoing.get(queue.shift()) || []) if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
  for (const [nodeIndex, node] of nodes.entries()) {
    if (!reachable.has(node.name) && roots.length) findings.push(finding({ rule: 'n8n.disconnected_node', title: 'Nodo no alcanzable desde un trigger', category: 'workflow_logic', severity: 'high', expected: 'Todo nodo útil debe estar conectado a una ruta ejecutable', observed: node.name, recommendation: 'Conectar el nodo o eliminarlo del workflow.', location: `${location}.nodes[${nodeIndex}]` }));
  }
  for (const [source, targets] of outgoing.entries()) for (const targetName of targets) if (!names.has(targetName)) findings.push(finding({ rule: 'n8n.dangling_reference', title: 'Conexión apunta a un nodo inexistente', category: 'workflow_logic', severity: 'high', expected: 'Destino presente en nodes', observed: `${source} → ${targetName}`, recommendation: 'Revisar conexiones del export.', location }));
  if (roots.length === 0) findings.push(finding({ rule: 'n8n.trigger_required', title: 'Workflow sin trigger reconocible', category: 'workflow_logic', severity: 'high', expected: 'Webhook, schedule, manual u otro trigger', observed: 'No se detectó trigger', recommendation: 'Agregar o documentar el mecanismo de inicio.', location }));
  return findings;
}

export function auditN8nExport(exported, target) {
  const workflows = Array.isArray(exported) ? exported : (Array.isArray(exported?.workflows) ? exported.workflows : [exported]);
  const findings = [];
  const inventory = { workflowCount: workflows.length, workflows: [] };
  for (const [index, workflow] of workflows.entries()) {
    const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
    inventory.workflows.push({ name: workflow?.name || `workflow-${index + 1}`, active: workflow?.active === true, nodeCount: nodes.length, nodeTypes: [...new Set(nodes.map((node) => node.type).filter(Boolean))] });
    findings.push(...auditN8nWorkflow(workflow, target, index));
  }
  return { findings, inventory };
}

export function baselineScenarios(target) {
  return [
    scenario('baseline-missing-input', 'Entrada ausente', 'validation', {}, 'Respuesta controlada sin excepción no manejada'),
    scenario('baseline-null-input', 'Entrada null', 'validation', { value: null }, 'Respuesta controlada y trazable'),
    scenario('baseline-duplicate', 'Evento duplicado', 'idempotency', { idempotencyKey: 'beta-duplicate-1', duplicate: true }, 'Procesar una sola vez o responder de forma idempotente'),
    scenario('baseline-unicode', 'Texto Unicode completo', 'encoding', { text: '¿Qué pasó, señor? áéíóúñü 👩🏽‍💻 é' }, 'Conservar caracteres y estructura'),
    scenario('baseline-unexpected-field', 'Campo inesperado', 'validation', { unexpected: true }, 'Ignorar o rechazar explícitamente'),
    scenario('baseline-long-input', 'Entrada extensa', 'limits', { text: 'x'.repeat(4096) }, 'Aplicar límite controlado sin romper el servicio'),
    scenario('baseline-timeout', 'Dependencia lenta', 'reliability', { simulateTimeout: true }, 'Timeout y estado observable'),
  ];
}

export function exploratoryScenarios(target, inventory = {}) {
  const base = baselineScenarios(target);
  if (target.type === 'n8n') base.push(scenario('n8n-empty-branch', 'Rama sin items', 'workflow_logic', { items: [] }, 'El workflow no debe marcar éxito falso ni perder contexto'));
  if (target.type === 'http' || target.type === 'webhook') base.push(scenario('http-invalid-json', 'JSON inválido', 'validation', '{"broken":', 'Respuesta 4xx controlada'));
  if (target.type === 'bot') base.push(scenario('bot-unknown-command', 'Comando desconocido', 'conversation', { text: 'comando que no existe' }, 'Respuesta útil sin ejecutar una acción peligrosa'));
  return base.map((item) => ({ ...item, generatedBy: 'deterministic-exploration', inventoryHint: inventory.workflowCount ? `${inventory.workflowCount} workflows` : undefined }));
}
