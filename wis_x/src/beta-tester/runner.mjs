import path from 'node:path';
import { auditBrowserTarget, auditHttpTarget, auditNodeScriptTarget, loadN8nSource } from './adapters.mjs';
import { buildReport, createAuditId, createContext, readJson } from './core.mjs';
import { generateExploratoryScenarios } from './exploratory.mjs';
import { auditHttpsUrl, auditN8nExport, auditTargetContract, selectedRules } from './rules.mjs';

export async function auditTarget(target, { configPath = process.cwd(), staging = false } = {}) {
  const startedAt = new Date().toISOString();
  const auditId = createAuditId();
  const normalizedTarget = normalizeTarget(target, staging);
  const context = createContext(normalizedTarget, { staging });
  const findings = [...auditTargetContract(normalizedTarget)];
  const scenarios = [];
  const evidence = [];
  let inventory = { selectedRules: selectedRules(normalizedTarget) };

  findings.push(...auditHttpsUrl(normalizedTarget.source?.baseUrl, { mode: context.mode }));
  let adapterResult = { findings: [], scenarios: [], inventory: {} };
  if (normalizedTarget.type === 'n8n') {
    try {
      const { exported, executions = [], securityAudit = null, source } = await loadN8nSource(normalizedTarget, configPath);
      const result = auditN8nExport(exported, normalizedTarget);
      adapterResult = { ...result, scenarios: [], inventory: { ...result.inventory, source, recentExecutions: executions.slice(0, 20).map((execution) => ({ id: execution.id, status: execution.status, startedAt: execution.startedAt, stoppedAt: execution.stoppedAt, workflowId: execution.workflowId })), n8nSecurityAudit: securityAudit ? { available: true, report: securityAudit } : { available: false } } };
      if (normalizedTarget.source?.baseUrl) {
        const httpResult = await auditHttpTarget(normalizedTarget, context);
        adapterResult.findings.push(...httpResult.findings);
        adapterResult.scenarios.push(...httpResult.scenarios);
        adapterResult.inventory.network = httpResult.inventory;
      }
    } catch (error) {
      adapterResult.findings.push({
        id: 'n8n.source_load_failed', rule: 'n8n.source_load_failed', title: 'No se pudo cargar la fuente n8n', category: 'configuration', severity: 'high', confidence: 1,
        expected: 'Export JSON o API disponible', observed: error.message, recommendation: 'Corregir source.exportPath o configurar la API de n8n.', location: '$.source', evidence: [],
      });
    }
  } else if (normalizedTarget.type === 'http' || normalizedTarget.type === 'webhook') adapterResult = await auditHttpTarget(normalizedTarget, context);
  else if (normalizedTarget.type === 'node-script') adapterResult = await auditNodeScriptTarget(normalizedTarget, configPath, context);
  else if (normalizedTarget.type === 'browser') adapterResult = await auditBrowserTarget(normalizedTarget, context);
  else adapterResult = { findings: [], scenarios: [], inventory: { adapter: 'static_only' } };

  findings.push(...adapterResult.findings);
  scenarios.push(...adapterResult.scenarios);
  inventory = { ...inventory, ...adapterResult.inventory };
  const exploratory = await generateExploratoryScenarios({ target: normalizedTarget, inventory });
  scenarios.push(...exploratory.scenarios);
  inventory.exploration = exploratory.source;
  const report = buildReport({ auditId, target: normalizedTarget, context, findings, scenarios, inventory, evidence });
  return report;
}

export async function loadTargetConfig(configPath) {
  const config = await readJson(configPath);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('audit_config_must_be_an_object');
  return config;
}

function normalizeTarget(target, staging) {
  const normalized = structuredClone(target);
  normalized.environment = staging ? 'staging' : (normalized.environment || 'local');
  if (process.env.BETA_TARGET_BASE_URL) normalized.source = { ...(normalized.source || {}), baseUrl: process.env.BETA_TARGET_BASE_URL };
  if (normalized.source?.exportPath) normalized.source.exportPath = path.normalize(normalized.source.exportPath);
  return normalized;
}
