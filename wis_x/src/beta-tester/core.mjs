import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export function createAuditId() {
  return `audit-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
}

export function finding({ rule, title, category, severity = 'medium', confidence = 1, expected, observed, recommendation, location, evidence = [] }) {
  return {
    id: `${rule}:${crypto.createHash('sha1').update(`${title}:${location || ''}`).digest('hex').slice(0, 10)}`,
    rule,
    title,
    category,
    severity,
    confidence: Math.max(0, Math.min(1, Number(confidence))),
    expected: expected || null,
    observed: observed || null,
    recommendation: recommendation || null,
    location: location || null,
    evidence,
  };
}

export function scenario(id, title, category, input, expected, options = {}) {
  return {
    id,
    title,
    category,
    input,
    expected,
    status: 'planned',
    ...options,
  };
}

export function walk(value, visitor, location = '$') {
  visitor(value, location);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${location}[${index}]`));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, visitor, `${location}.${key}`);
  }
}

const SECRET_KEY = /(token|secret|password|passwd|authorization|cookie|api[-_]?key|private[-_]?key)/i;
const SECRET_VALUE = /^(bearer\s+|sk[-_]|xox[baprs]-|gh[pousr]_|eyJ[a-zA-Z0-9_-]+\.)/i;

export function redact(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi, 'Bearer [REDACTED]')
      .replace(/(api[_-]?key|token|secret|password|authorization|cookie)\s*[:=]\s*[^\s,;}]+/gi, '$1=[REDACTED]')
      .replace(SECRET_VALUE, '[REDACTED]');
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]));
  }
  return value;
}

export function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
}

export function isAllowedHost(value, allowedHosts = []) {
  try {
    const url = new URL(value);
    return allowedHosts.includes(url.host) || allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export function requireNetworkPermission(target, context) {
  if (context.mode === 'local') throw new Error('network_disabled_in_local_mode');
  if (process.env.BETA_ALLOW_NETWORK !== 'true') throw new Error('set_BETA_ALLOW_NETWORK_true_to_run_staging');
  const allowedHosts = context.allowedHosts;
  let host = 'invalid_url';
  try { host = new URL(target).host; } catch { /* Keep safe error below. */ }
  if (!isAllowedHost(target, allowedHosts)) throw new Error(`host_not_allowlisted:${host}`);
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function ensureDirectory(directory) {
  await fs.mkdir(directory, { recursive: true });
}

export async function writeJson(filePath, value) {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(redact(value), null, 2)}\n`, 'utf8');
}

export function createContext(target, { staging = false } = {}) {
  const mode = staging ? 'staging' : (target.environment || 'local');
  const configuredHosts = String(process.env.BETA_ALLOWED_HOSTS || '')
    .split(',').map((host) => host.trim()).filter(Boolean);
  return {
    mode,
    allowedHosts: configuredHosts,
    allowSideEffects: process.env.BETA_ALLOW_SIDE_EFFECTS === 'true',
    timeoutMs: Number(process.env.BETA_TIMEOUT_MS || 10_000),
    target,
  };
}

export function summarize(findings, scenarios = []) {
  const summary = {
    findings: findings.length,
    scenarios: scenarios.length,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    byStatus: { planned: 0, passed: 0, failed: 0, blocked: 0, not_applicable: 0 },
  };
  for (const item of findings) summary.bySeverity[item.severity] = (summary.bySeverity[item.severity] || 0) + 1;
  for (const item of scenarios) summary.byStatus[item.status] = (summary.byStatus[item.status] || 0) + 1;
  return summary;
}

export function sortFindings(findings) {
  return [...findings].sort((a, b) => (SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]) || a.title.localeCompare(b.title));
}

export function buildReport({ auditId, target, context, findings, scenarios, inventory = {}, evidence = [], startedAt }) {
  const finishedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    auditId,
    startedAt,
    finishedAt,
    target: redact(target),
    execution: {
      mode: context.mode,
      networkEnabled: process.env.BETA_ALLOW_NETWORK === 'true',
      sideEffectsEnabled: context.allowSideEffects,
      allowedHosts: context.allowedHosts,
    },
    inventory: redact(inventory),
    summary: summarize(findings, scenarios),
    findings: sortFindings(findings),
    scenarios,
    evidence: redact(evidence),
  };
}

export async function writeReport(report, outDir) {
  await ensureDirectory(outDir);
  await ensureDirectory(path.join(outDir, 'evidence'));
  await writeJson(path.join(outDir, 'report.json'), report);
  const html = renderHtml(report);
  await fs.writeFile(path.join(outDir, 'report.html'), html, 'utf8');
  return {
    jsonPath: path.join(outDir, 'report.json'),
    htmlPath: path.join(outDir, 'report.html'),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderHtml(report) {
  const rows = report.findings.map((item) => `<tr><td>${escapeHtml(item.severity)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.location || '')}</td><td>${escapeHtml(item.recommendation || '')}</td></tr>`).join('');
  const scenarioRows = report.scenarios.map((item) => `<tr><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.expected)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beta Tester ${escapeHtml(report.target?.name || '')}</title>
<style>body{font-family:system-ui,sans-serif;max-width:1200px;margin:2rem auto;padding:0 1rem;color:#202124}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #ddd;padding:.55rem;text-align:left;vertical-align:top}th{background:#f3f4f6}.high,.critical{color:#a40000}.medium{color:#9a6700}.low,.info{color:#355c7d}.cards{display:flex;gap:1rem;flex-wrap:wrap}.card{background:#f3f4f6;padding:1rem;border-radius:.5rem}.muted{color:#666}</style></head>
<body><h1>Beta Tester: ${escapeHtml(report.target?.name || 'auditoría')}</h1><p class="muted">${escapeHtml(report.auditId)} · modo ${escapeHtml(report.execution.mode)}</p>
<div class="cards"><div class="card">Hallazgos: <strong>${report.summary.findings}</strong></div><div class="card">Escenarios: <strong>${report.summary.scenarios}</strong></div><div class="card">Críticos/altos: <strong>${report.summary.bySeverity.critical + report.summary.bySeverity.high}</strong></div><div class="card">Bloqueados: <strong>${report.summary.byStatus.blocked}</strong></div></div>
<h2>Hallazgos</h2><table><thead><tr><th>Severidad</th><th>Categoría</th><th>Título</th><th>Ubicación</th><th>Recomendación</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin hallazgos</td></tr>'}</tbody></table>
<h2>Escenarios</h2><table><thead><tr><th>Estado</th><th>Categoría</th><th>Título</th><th>Resultado esperado</th></tr></thead><tbody>${scenarioRows || '<tr><td colspan="4">Sin escenarios</td></tr>'}</tbody></table>
<h2>Inventario</h2><pre>${escapeHtml(JSON.stringify(report.inventory, null, 2))}</pre></body></html>`;
}
