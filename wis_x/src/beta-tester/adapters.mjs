import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { finding, requireNetworkPermission, scenario } from './core.mjs';
import { auditHttpsUrl } from './rules.mjs';

function resolveSourcePath(configPath, value) {
  if (path.isAbsolute(value)) return value;
  return path.resolve(path.dirname(configPath), '..', value);
}

function syntaxCheck(filePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--check', filePath], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => resolve({ ok: false, error: error.message }));
    child.on('close', (code) => resolve({ ok: code === 0, error: stderr.trim() || null }));
  });
}

export const UNICODE_CORPUS = [
  'áéíóúñü',
  '¿Qué pasó, señor? ¡Funciona!',
  '👩🏽‍💻🚀🧉',
  'e\u0301 / é / عربى / русский / português',
  'línea 1\nlínea 2\t“comillas” \\ barra',
  'https://example.com/ruta?q=qué%20tal&emoji=🚀',
];

export async function loadN8nSource(target, configPath) {
  if (target.source?.exportPath) {
    const filePath = resolveSourcePath(configPath, target.source.exportPath);
    return { exported: JSON.parse(await fs.readFile(filePath, 'utf8')), source: filePath };
  }
  if (target.source?.workflowId) {
    const base = target.source.apiBaseUrl || process.env.N8N_API_BASE_URL;
    const key = process.env.N8N_API_KEY;
    if (!base || !key) throw new Error('n8n_api_requires_N8N_API_BASE_URL_and_N8N_API_KEY');
    requireNetworkPermission(base, { mode: 'staging', allowedHosts: String(process.env.BETA_ALLOWED_HOSTS || '').split(',').map((value) => value.trim()).filter(Boolean) });
    const response = await fetch(`${base.replace(/\/$/, '')}/api/v1/workflows/${encodeURIComponent(target.source.workflowId)}`, { headers: { 'X-N8N-API-KEY': key }, signal: AbortSignal.timeout(Number(process.env.BETA_TIMEOUT_MS || 10000)) });
    if (!response.ok) throw new Error(`n8n_api_${response.status}`);
    let executions = [];
    try {
      const executionResponse = await fetch(`${base.replace(/\/$/, '')}/api/v1/executions?workflowId=${encodeURIComponent(target.source.workflowId)}&limit=20`, { headers: { 'X-N8N-API-KEY': key }, signal: AbortSignal.timeout(Number(process.env.BETA_TIMEOUT_MS || 10000)) });
      if (executionResponse.ok) executions = (await executionResponse.json()).data || [];
    } catch { /* Execution history is optional and must not block static audit. */ }
    const exported = await response.json();
    let securityAudit = null;
    if (process.env.BETA_RUN_N8N_AUDIT === 'true') {
      const auditResponse = await fetch(`${base.replace(/\/$/, '')}/audit`, { method: 'POST', headers: { 'X-N8N-API-KEY': key, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(Number(process.env.BETA_TIMEOUT_MS || 10000)) });
      if (auditResponse.ok) securityAudit = await auditResponse.json();
    }
    return { exported, executions, securityAudit, source: `${base}/api/v1/workflows/${target.source.workflowId}` };
  }
  throw new Error('n8n_source_requires_exportPath_or_workflowId');
}

export async function auditHttpTarget(target, context) {
  const findings = [...auditHttpsUrl(target.source?.baseUrl, { mode: context.mode })];
  const scenarios = [];
  const baseUrl = target.source?.baseUrl;
  if (!baseUrl) return { findings, scenarios, inventory: { network: 'not_configured' } };
  if (context.mode === 'local') {
    scenarios.push(scenario('http-network-blocked', 'Prueba HTTP bloqueada en modo local', 'safety', null, 'No realizar llamadas de red', { status: 'blocked', reason: 'local_mode' }));
    return { findings, scenarios, inventory: { network: 'disabled', baseUrl } };
  }
  try { requireNetworkPermission(baseUrl, context); } catch (error) {
    findings.push(finding({ rule: 'http.execution_guard', title: 'La prueba de red fue bloqueada por seguridad', category: 'safety', severity: 'info', expected: 'Host permitido y BETA_ALLOW_NETWORK=true', observed: error.message, recommendation: 'Configurar staging y allowlist explícita antes de ejecutar.', location: '$.source.baseUrl' }));
    scenarios.push(scenario('http-network-guard', 'Guard de red', 'safety', null, 'No salir de la allowlist', { status: 'blocked', reason: error.message }));
    return { findings, scenarios, inventory: { network: 'blocked', baseUrl } };
  }
  const paths = target.paths || [target.source.healthPath || '/health'];
  const results = [];
  for (const requestPath of paths) {
    const url = new URL(requestPath, baseUrl).toString();
    const started = Date.now();
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(context.timeoutMs) });
      const body = await response.text();
      const contentType = response.headers.get('content-type') || '';
      const statusExpected = target.contract?.expectedStatus ?? 200;
      const evidence = { url, status: response.status, contentType, durationMs: Date.now() - started, bodyPreview: body.slice(0, 1000) };
      results.push(evidence);
      if (response.status !== statusExpected) findings.push(finding({ rule: 'http.expected_status', title: 'Endpoint devolvió un estado inesperado', category: 'http', severity: 'high', expected: statusExpected, observed: response.status, recommendation: 'Revisar despliegue, ruta y contrato del endpoint.', location: url, evidence: [url] }));
      if (response.status >= 300 && response.status < 400 && (response.headers.get('location') || '').startsWith('http://')) findings.push(finding({ rule: 'https.downgrade_redirect', title: 'Redirect de HTTPS a HTTP', category: 'https', severity: 'high', expected: 'Mantener HTTPS', observed: response.headers.get('location'), recommendation: 'Eliminar el downgrade o corregir el proxy.', location: url }));
      if (/json/i.test(contentType) && !/charset=utf-8/i.test(contentType)) findings.push(finding({ rule: 'encoding.content_type', title: 'Respuesta JSON sin charset UTF-8 explícito', category: 'encoding', severity: 'low', expected: 'application/json; charset=utf-8', observed: contentType, recommendation: 'Declarar charset=utf-8 si el contrato lo requiere.', location: url }));
      if (/�/.test(body)) findings.push(finding({ rule: 'encoding.mojibake', title: 'Respuesta contiene carácter de reemplazo Unicode', category: 'encoding', severity: 'high', expected: 'Texto UTF-8 sin corrupción', observed: '� detectado', recommendation: 'Revisar serialización, headers y decodificación.', location: url }));
      scenarios.push(scenario(`http-smoke-${requestPath}`, `Smoke ${requestPath}`, 'http', { method: 'GET', url }, `HTTP ${statusExpected}`, { status: response.status === statusExpected ? 'passed' : 'failed', observed: evidence }));
    } catch (error) {
      findings.push(finding({ rule: 'http.request_failed', title: 'No se pudo completar la solicitud HTTP', category: 'availability', severity: 'high', expected: 'Respuesta dentro del timeout', observed: error.message, recommendation: 'Revisar DNS, TLS, proxy, ruta y disponibilidad del servicio.', location: url }));
      scenarios.push(scenario(`http-smoke-${requestPath}`, `Smoke ${requestPath}`, 'http', { method: 'GET', url }, `HTTP ${target.contract?.expectedStatus ?? 200}`, { status: 'failed', observed: error.message }));
    }
  }
  const roundTripPath = target.contract?.roundTripPath || target.source?.roundTripPath;
  if (roundTripPath && target.contract?.roundTripSafe === true) {
    const url = new URL(roundTripPath, baseUrl).toString();
    for (const text of UNICODE_CORPUS) {
      try {
        const response = await fetch(url, { method: target.contract.method || 'POST', headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(context.timeoutMs) });
        const body = await response.text();
        const preserved = body.includes(text);
        scenarios.push(scenario(`encoding-${Buffer.from(text).toString('hex').slice(0, 12)}`, 'UTF-8 round-trip', 'encoding', { text }, 'Respuesta conserva exactamente el texto', { status: response.ok && preserved ? 'passed' : 'failed', observed: { status: response.status, preserved, bodyPreview: body.slice(0, 500) } }));
        if (!preserved) findings.push(finding({ rule: 'encoding.round_trip', title: 'El endpoint altera o pierde caracteres Unicode', category: 'encoding', severity: 'high', expected: text, observed: body.slice(0, 500), recommendation: 'Revisar Content-Type, serialización JSON y decodificación UTF-8.', location: url }));
      } catch (error) { findings.push(finding({ rule: 'encoding.round_trip_failed', title: 'Falló la prueba de round-trip Unicode', category: 'encoding', severity: 'high', expected: 'Endpoint responde a payload UTF-8', observed: error.message, recommendation: 'Revisar endpoint, TLS y límites de body.', location: url })); }
    }
  } else if (roundTripPath) {
    scenarios.push(scenario('encoding-round-trip-blocked', 'Round-trip Unicode bloqueado', 'safety', null, 'Sólo probar endpoints declarados como seguros', { status: 'blocked', reason: 'contract.roundTripSafe != true' }));
  }
  return { findings, scenarios, inventory: { network: 'executed', baseUrl, results } };
}

export async function auditNodeScriptTarget(target, configPath, context) {
  const entrypoint = target.source?.entrypoint;
  const findings = [];
  const scenarios = [];
  if (!entrypoint) return { findings: [finding({ rule: 'script.entrypoint_required', title: 'Script sin entrypoint', category: 'configuration', severity: 'high', expected: 'Ruta de script explícita', observed: 'entrypoint ausente', recommendation: 'Declarar el script y mantener la ejecución bloqueada por defecto.' })], scenarios, inventory: { execution: 'not_available' } };
  const filePath = resolveSourcePath(configPath, entrypoint);
  const source = await fs.readFile(filePath, 'utf8');
  const syntax = await syntaxCheck(filePath);
  if (!syntax.ok) findings.push(finding({ rule: 'script.syntax', title: 'El script no pasa la validación de sintaxis', category: 'script', severity: 'high', expected: 'node --check sin errores', observed: syntax.error, recommendation: 'Corregir la sintaxis antes de ejecutar el script.', location: filePath }));
  if (/child_process|execSync|spawn\(/.test(source)) findings.push(finding({ rule: 'script.process_access', title: 'Script puede crear procesos', category: 'security', severity: 'high', expected: 'Ejecución aislada y aprobada', observed: 'API de procesos detectada', recommendation: 'Revisar el script antes de habilitar ejecución.' , location: filePath }));
  if (/fs\.|readFile|writeFile|rmSync|unlink/.test(source)) findings.push(finding({ rule: 'script.filesystem_access', title: 'Script accede al filesystem', category: 'security', severity: 'medium', expected: 'Directorio temporal aislado', observed: 'API filesystem detectada', recommendation: 'Limitar filesystem y probar en sandbox.', location: filePath }));
  if (/fetch\(|axios|https?:\/\//.test(source)) findings.push(finding({ rule: 'script.network_access', title: 'Script puede acceder a red', category: 'security', severity: 'medium', expected: 'Red bloqueada o allowlist', observed: 'Acceso de red detectado', recommendation: 'Mantener la ejecución bloqueada salvo staging autorizado.', location: filePath }));
  if (/(process\.env\.[A-Z_]+|process\.env\[['"][A-Z_]+)/.test(source)) findings.push(finding({ rule: 'script.environment_contract', title: 'Script depende de variables de entorno', category: 'configuration', severity: 'info', expected: 'Variables documentadas y sintéticas en tests', observed: 'process.env detectado', recommendation: 'Declarar variables requeridas en el contrato.', location: filePath }));
  scenarios.push(scenario('script-static-only', 'Ejecución de script arbitrario bloqueada', 'safety', null, 'No ejecutar scripts desconocidos dentro del proceso principal', { status: 'blocked', reason: context.allowSideEffects ? 'sandbox_not_implemented' : 'side_effects_disabled' }));
  return { findings, scenarios, inventory: { entrypoint: filePath, execution: 'static_only', bytes: Buffer.byteLength(source, 'utf8') } };
}

export async function auditBrowserTarget(target, context) {
  const findings = [...auditHttpsUrl(target.source?.baseUrl, { mode: context.mode })];
  const scenarios = [];
  if (!target.source?.baseUrl) return { findings: [finding({ rule: 'browser.base_url_required', title: 'Browser audit sin baseUrl', category: 'configuration', severity: 'high', expected: 'URL de staging', observed: 'baseUrl ausente', recommendation: 'Configurar source.baseUrl.' })], scenarios, inventory: { browser: 'not_configured' } };
  if (context.mode === 'local') return { findings, scenarios: [scenario('browser-local-blocked', 'Browser audit bloqueada en local', 'safety', null, 'No acceder a red en modo local', { status: 'blocked', reason: 'local_mode' })], inventory: { browser: 'disabled' } };
  try { requireNetworkPermission(target.source.baseUrl, context); } catch (error) { return { findings, scenarios: [scenario('browser-network-guard', 'Browser audit bloqueada por allowlist', 'safety', null, 'Host autorizado', { status: 'blocked', reason: error.message })], inventory: { browser: 'blocked' } }; }
  let playwright;
  try { playwright = await import('playwright'); } catch { return { findings: [...findings, finding({ rule: 'browser.playwright_missing', title: 'Playwright no está instalado', category: 'tooling', severity: 'info', expected: 'Dependencia opcional instalada para browser audit', observed: 'import playwright falló', recommendation: 'Instalar Playwright y sus navegadores antes de ejecutar audit:browser.' })], scenarios: [scenario('browser-dependency', 'Playwright disponible', 'tooling', null, 'Importar Playwright', { status: 'blocked', reason: 'dependency_missing' })], inventory: { browser: 'dependency_missing' } }; }
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const paths = target.paths || ['/'];
  for (const requestPath of paths) {
    const url = new URL(requestPath, target.source.baseUrl).toString();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: context.timeoutMs });
      await page.screenshot({ path: path.resolve('reports', 'beta-tester-browser', `${encodeURIComponent(requestPath)}.png`), fullPage: true });
      scenarios.push(scenario(`browser-${requestPath}`, `Browser smoke ${requestPath}`, 'browser', { url }, 'Página carga sin errores de consola', { status: response?.ok() && consoleErrors.length === 0 ? 'passed' : 'failed', observed: { status: response?.status(), consoleErrors } }));
      if (consoleErrors.length) findings.push(finding({ rule: 'browser.console_error', title: 'La página registra errores de consola', category: 'browser', severity: 'medium', expected: 'Sin errores de consola', observed: consoleErrors.slice(0, 10), recommendation: 'Revisar errores JavaScript y recursos fallidos.', location: url }));
    } catch (error) { findings.push(finding({ rule: 'browser.navigation_failed', title: 'No se pudo abrir la página', category: 'browser', severity: 'high', expected: 'Carga dentro del timeout', observed: error.message, recommendation: 'Revisar despliegue, TLS y ruta.', location: url })); scenarios.push(scenario(`browser-${requestPath}`, `Browser smoke ${requestPath}`, 'browser', { url }, 'Página cargada', { status: 'failed', observed: error.message })); }
  }
  await browser.close();
  return { findings, scenarios, inventory: { browser: 'executed', paths } };
}
