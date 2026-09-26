import fs from 'node:fs';

const envPath = 'C:/Users/Operador/Desktop/Playground/.env';
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const configuredBase = (env.N8N_API_BASE_URL || '').replace(/\/$/, '');
const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
const headers = { 'X-N8N-API-KEY': env.N8N_API_KEY };

if (!configuredBase || !env.N8N_API_KEY) throw new Error('Falta configurar la API de n8n');

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json();
}

const defaultWorkflowIds = [
  'um0levNI0wM7FROb',
  'AUXgK79OHhhUu2iR',
  '1ZWaUJr5t3HWFrqa',
  'nEzq5nGzYQ663wXM',
  'rm5WVrtOIsBsK2Lq',
  'nluwzHbQgfHFP0Qr',
  'RnlodwUORkQiUsv3',
];
const workflowIds = process.argv.slice(2).length ? process.argv.slice(2) : defaultWorkflowIds;

function summarizeCondition(node) {
  if (node.type !== 'n8n-nodes-base.if') return undefined;
  const conditions = node.parameters?.conditions || {};
  return {
    combinator: conditions.combinator ?? null,
    topLevelOptions: node.parameters?.options ?? null,
    conditionOptions: conditions.options ?? null,
    conditions: (conditions.conditions || []).map((condition) => ({
      hasId: Boolean(condition.id),
      leftValue: condition.leftValue,
      rightValue: condition.rightValue,
      rightValueType: typeof condition.rightValue,
      operator: condition.operator,
    })),
  };
}

function summarizeNode(node) {
  const jsCode = node.parameters?.jsCode || '';
  return {
    name: node.name,
    type: node.type,
    disabled: Boolean(node.disabled),
    webhook: node.type === 'n8n-nodes-base.webhook' ? {
      method: node.parameters?.httpMethod,
      path: node.parameters?.path,
      responseMode: node.parameters?.responseMode,
    } : undefined,
    schedule: node.type === 'n8n-nodes-base.scheduleTrigger' ? node.parameters?.rule : undefined,
    if: summarizeCondition(node),
    response: node.type === 'n8n-nodes-base.respondToWebhook' ? {
      responseCode: node.parameters?.options?.responseCode ?? 200,
      responseBody: node.parameters?.responseBody,
    } : undefined,
    supabase: node.type === 'n8n-nodes-base.supabase' ? {
      operation: node.parameters?.operation,
      tableId: node.parameters?.tableId,
      filterType: node.parameters?.filterType,
      filters: node.parameters?.filters,
      fieldsUiKeys: Object.keys(node.parameters?.fieldsUi?.fieldValues?.reduce?.((acc, field) => {
        acc[field.fieldId] = true;
        return acc;
      }, {}) || {}),
      credential: node.credentials?.supabaseApi?.name,
    } : undefined,
    telegram: /telegram/i.test(node.type) ? {
      operation: node.parameters?.operation,
      chatId: node.parameters?.chatId,
      credential: node.credentials?.telegramApi?.name,
    } : undefined,
    http: node.type === 'n8n-nodes-base.httpRequest' ? {
      method: node.parameters?.method || 'GET',
      url: String(node.parameters?.url || '').replace(/Bearer\s+[^\s"'}]+/gi, 'Bearer [REDACTED]'),
      credentialTypes: Object.keys(node.credentials || {}),
    } : undefined,
    codeSignals: node.type === 'n8n-nodes-base.code' ? {
      readsBotSecret: /bot.?secret|x-bot-secret/i.test(jsCode),
      readsSystemEnabled: /SYSTEM_ENABLED/.test(jsCode),
      readsAutoPublish: /AUTO_PUBLISH/.test(jsCode),
      parsesJsonUnsafely: /JSON\.parse\s*\(/.test(jsCode) && !/try\s*\{[\s\S]*JSON\.parse/.test(jsCode),
      returns401: /401/.test(jsCode),
      codeLength: jsCode.length,
    } : undefined,
    credentials: Object.fromEntries(Object.entries(node.credentials || {}).map(([type, ref]) => [type, ref.name])),
  };
}

function summarizeConnections(connections) {
  const edges = [];
  for (const [from, groups] of Object.entries(connections || {})) {
    for (const [output, targets] of (groups.main || []).entries()) {
      for (const target of targets) edges.push({ from, output, to: target.node });
    }
  }
  return edges;
}

const report = [];
for (const id of workflowIds) {
  const workflow = await api(`/workflows/${id}`);
  const executions = await api(`/executions?workflowId=${id}&limit=10`);
  report.push({
    id,
    name: workflow.name,
    active: workflow.active,
    updatedAt: workflow.updatedAt,
    nodeCount: workflow.nodes.length,
    settings: workflow.settings,
    nodes: workflow.nodes.map(summarizeNode),
    edges: summarizeConnections(workflow.connections),
    executions: executions.data.map((execution) => ({
      id: execution.id,
      status: execution.status,
      mode: execution.mode,
      startedAt: execution.startedAt,
      stoppedAt: execution.stoppedAt,
    })),
  });
}

console.log(JSON.stringify(report, null, 2));
