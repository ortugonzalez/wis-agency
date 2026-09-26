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
const legacyId = 'nEzq5nGzYQ663wXM';
const dedicatedName = 'WIS X - Publisher Telegram Dedicated';
const publisherCredentialName = 'Telegram X Publisher Bot';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

const legacy = await api(`/workflows/${legacyId}`);
const publisherCredential = { id: 'Qv5vY4LFGWET4CUC', name: publisherCredentialName };
const allWorkflows = await api('/workflows?limit=100');

const byName = (name) => legacy.nodes.find((node) => node.name === name);
const clone = (sourceName, name, id, patch = {}) => ({ ...structuredClone(byName(sourceName)), ...patch, id, name });
const supabaseCredentials = structuredClone(byName('Get Latest X Pending Post').credentials);
const openAiCredentials = structuredClone(byName('Call OpenAI (X regen)').credentials);
const xCredentials = structuredClone(byName('Publish X Approved Post').credentials);
const telegramCredentials = { telegramApi: { id: publisherCredential.id, name: publisherCredential.name } };
const replaceTelegramCredential = (node) => { node.credentials = telegramCredentials; return node; };

const extractCode = byName('Extract & Normalize').parameters.jsCode;
const mergeCode = `
const ctx = $('Extract & Normalize').first().json;
const marker = '[[WIS_X]]';
const xp = $('Get Latest X Pending Post').all().map((item) => item.json).filter((item) => item?.id && item.estado === 'draft_enviado' && String(item.draft || '').startsWith(marker));
const replyId = ctx.reply_to_message_id ? String(ctx.reply_to_message_id) : null;
const xReply = replyId ? xp.find((item) => String(item.telegram_msg_id || '') === replyId) : null;
let post = null;
let ambiguous = false;
if (xReply) post = xReply;
else if (!replyId && xp.length === 1) post = xp[0];
else if (!replyId && xp.length > 1) ambiguous = true;
return [{ json: { ...ctx, post, platform: 'x', ambiguous, reply_matches: !replyId || Boolean(xReply), auto_publish: true } }];`;
const routeCode = `
const j = $json;
if (j.ambiguous) return [{ json: { ...j, route: 'unknown', ambiguity: true } }];
if (!j.post && j.reply_to_message_id) return [{ json: { ...j, route: 'unknown', reply_mismatch: true } }];
if (!j.post) return [{ json: { ...j, route: 'unknown', no_pending: true } }];
return [{ json: { ...j, route: 'x_' + j.categoria } }];`;

const trigger = replaceTelegramCredential(clone('TelegramInbound', 'Telegram X Publisher Trigger', 'x-dedicated-telegram-trigger-20260826', { position: [-220, 0] }));
const extract = clone('Extract & Normalize', 'Extract & Normalize', 'x-dedicated-extract-20260826', { position: [0, 0], parameters: { jsCode: extractCode } });
const auth = clone('IF Telegram Autorizado', 'IF Telegram Autorizado', 'x-dedicated-auth-20260826', { position: [220, 0] });
const pending = clone('Get Latest X Pending Post', 'Get Latest X Pending Post', 'x-dedicated-pending-20260826', { position: [440, 0], credentials: supabaseCredentials });
const merge = clone('Merge Context', 'Merge Context', 'x-dedicated-merge-20260826', { position: [660, 0], parameters: { jsCode: mergeCode } });
const route = clone('Route', 'Route', 'x-dedicated-route-20260826', { position: [880, 0], parameters: { jsCode: routeCode } });
const xApproved = clone('Filter X Aprobado', 'Filter X Aprobado', 'x-dedicated-filter-approved-20260826', { position: [1100, -360] });
const xEdit = clone('Filter X Editar', 'Filter X Editar', 'x-dedicated-filter-edit-20260826', { position: [1100, -180] });
const xRejected = clone('Filter X Rechazado', 'Filter X Rechazado', 'x-dedicated-filter-rejected-20260826', { position: [1100, 260] });
const xUnknown = clone('Filter: Unknown', 'Filter X Unknown', 'x-dedicated-filter-unknown-20260826', { position: [1100, 460] });
const xPatchApproved = clone('Patch X Aprobado', 'Patch X Aprobado', 'x-dedicated-patch-approved-20260826', { position: [1340, -360], credentials: supabaseCredentials });
const xGate = clone('X Publish Gate', 'X Publish Gate', 'x-dedicated-gate-20260826', { position: [1580, -480] });
const xPublishIf = clone('IF X Publish Enabled', 'IF X Publish Enabled', 'x-dedicated-publish-if-20260826', { position: [1820, -360] });
const xPublish = clone('Publish X Approved Post', 'Publish X Approved Post', 'x-dedicated-publish-20260826', { position: [2060, -440], credentials: xCredentials });
const xPatchPublished = clone('Patch X Publicado', 'Patch X Publicado', 'x-dedicated-patch-published-20260826', { position: [2300, -440], credentials: supabaseCredentials });
const xTelegramPublished = replaceTelegramCredential(clone('Telegram X Publicado', 'Telegram X Publicado', 'x-dedicated-telegram-published-20260826', { position: [2540, -440] }));
const xPatchError = clone('Patch X Error', 'Patch X Error', 'x-dedicated-patch-error-20260826', { position: [2300, -520], credentials: supabaseCredentials });
const xTelegramError = replaceTelegramCredential(clone('Telegram X Error', 'Telegram X Error', 'x-dedicated-telegram-error-20260826', { position: [2540, -520] }));
const xTelegramApproved = replaceTelegramCredential(clone('Telegram X Aprobado', 'Telegram X Aprobado', 'x-dedicated-telegram-approved-20260826', { position: [1580, -260] }));
const xBuildPrompt = clone('Build X Regenerate Prompt', 'Build X Regenerate Prompt', 'x-dedicated-build-prompt-20260826', { position: [1340, -180] });
const xOpenAi = clone('Call OpenAI (X regen)', 'Call OpenAI (X regen)', 'x-dedicated-openai-regen-20260826', { position: [1580, -180], credentials: openAiCredentials });
const xParse = clone('Parse X Regen', 'Parse X Regen', 'x-dedicated-parse-regen-20260826', { position: [1820, -180] });
const xRegenIf = clone('IF X Regen Valido', 'IF X Regen Valido', 'x-dedicated-regen-if-20260826', { position: [2060, -180] });
const xPatchDraft = clone('Patch X Nuevo Draft', 'Patch X Nuevo Draft', 'x-dedicated-patch-draft-20260826', { position: [2300, -260], credentials: supabaseCredentials });
const xBuildMessage = clone('Build X Nuevo Draft Msg', 'Build X Nuevo Draft Msg', 'x-dedicated-build-message-20260826', { position: [2540, -260] });
const xTelegramDraft = replaceTelegramCredential(clone('Telegram X Nuevo Draft', 'Telegram X Nuevo Draft', 'x-dedicated-telegram-draft-20260826', { position: [2780, -260] }));
const xPatchMessageId = clone('Patch X Telegram Msg ID', 'Patch X Telegram Msg ID', 'x-dedicated-patch-message-id-20260826', { position: [3020, -260], credentials: supabaseCredentials });
const xTelegramRegenError = replaceTelegramCredential(clone('Telegram X Error Regen', 'Telegram X Error Regen', 'x-dedicated-telegram-regen-error-20260826', { position: [2300, -80] }));
const xPatchRejected = clone('Patch X Rechazado', 'Patch X Rechazado', 'x-dedicated-patch-rejected-20260826', { position: [1340, 260], credentials: supabaseCredentials });
const xTelegramRejected = replaceTelegramCredential(clone('Telegram X Rechazado', 'Telegram X Rechazado', 'x-dedicated-telegram-rejected-20260826', { position: [1580, 260] }));
const xClarification = replaceTelegramCredential(clone('Telegram Aclaracion', 'Telegram X Aclaracion', 'x-dedicated-telegram-clarification-20260826', { position: [1340, 460], parameters: { chatId: '7512675688', text: "={{ $json.ambiguity ? 'Hay más de un borrador X activo. Respondé directamente al mensaje que querés aprobar, editar o descartar.' : ($json.no_pending ? 'No encontré un borrador vigente de X.' : ($json.reply_mismatch ? 'Ese mensaje no responde al borrador X activo. Respondé directamente al último borrador.' : 'No entendí la respuesta. Usá OK, EDITAR: <cambios> o NO.')) }}", additionalFields: {} } }));

const nodes = [trigger, extract, auth, pending, merge, route, xApproved, xEdit, xRejected, xUnknown, xPatchApproved, xGate, xPublishIf, xPublish, xPatchPublished, xTelegramPublished, xPatchError, xTelegramError, xTelegramApproved, xBuildPrompt, xOpenAi, xParse, xRegenIf, xPatchDraft, xBuildMessage, xTelegramDraft, xPatchMessageId, xTelegramRegenError, xPatchRejected, xTelegramRejected, xClarification];
const connections = {
  'Telegram X Publisher Trigger': { main: [[{ node: 'Extract & Normalize', type: 'main', index: 0 }]] },
  'Extract & Normalize': { main: [[{ node: 'IF Telegram Autorizado', type: 'main', index: 0 }]] },
  'IF Telegram Autorizado': { main: [[{ node: 'Get Latest X Pending Post', type: 'main', index: 0 }], []] },
  'Get Latest X Pending Post': { main: [[{ node: 'Merge Context', type: 'main', index: 0 }]] },
  'Merge Context': { main: [[{ node: 'Route', type: 'main', index: 0 }]] },
  'Route': { main: [[
    { node: 'Filter X Aprobado', type: 'main', index: 0 },
    { node: 'Filter X Editar', type: 'main', index: 0 },
    { node: 'Filter X Rechazado', type: 'main', index: 0 },
    { node: 'Filter X Unknown', type: 'main', index: 0 },
  ]] },
  'Filter X Aprobado': { main: [[{ node: 'Patch X Aprobado', type: 'main', index: 0 }]] },
  'Patch X Aprobado': { main: [[{ node: 'X Publish Gate', type: 'main', index: 0 }]] },
  'X Publish Gate': { main: [[{ node: 'IF X Publish Enabled', type: 'main', index: 0 }]] },
  'IF X Publish Enabled': { main: [[{ node: 'Publish X Approved Post', type: 'main', index: 0 }], [{ node: 'Telegram X Aprobado', type: 'main', index: 0 }]] },
  'Publish X Approved Post': { main: [[{ node: 'Patch X Publicado', type: 'main', index: 0 }], [{ node: 'Patch X Error', type: 'main', index: 0 }]] },
  'Patch X Publicado': { main: [[{ node: 'Telegram X Publicado', type: 'main', index: 0 }]] },
  'Patch X Error': { main: [[{ node: 'Telegram X Error', type: 'main', index: 0 }]] },
  'Filter X Editar': { main: [[{ node: 'Build X Regenerate Prompt', type: 'main', index: 0 }]] },
  'Build X Regenerate Prompt': { main: [[{ node: 'Call OpenAI (X regen)', type: 'main', index: 0 }]] },
  'Call OpenAI (X regen)': { main: [[{ node: 'Parse X Regen', type: 'main', index: 0 }]] },
  'Parse X Regen': { main: [[{ node: 'IF X Regen Valido', type: 'main', index: 0 }]] },
  'IF X Regen Valido': { main: [[{ node: 'Patch X Nuevo Draft', type: 'main', index: 0 }], [{ node: 'Telegram X Error Regen', type: 'main', index: 0 }]] },
  'Patch X Nuevo Draft': { main: [[{ node: 'Build X Nuevo Draft Msg', type: 'main', index: 0 }]] },
  'Build X Nuevo Draft Msg': { main: [[{ node: 'Telegram X Nuevo Draft', type: 'main', index: 0 }]] },
  'Telegram X Nuevo Draft': { main: [[{ node: 'Patch X Telegram Msg ID', type: 'main', index: 0 }]] },
  'Filter X Rechazado': { main: [[{ node: 'Patch X Rechazado', type: 'main', index: 0 }]] },
  'Patch X Rechazado': { main: [[{ node: 'Telegram X Rechazado', type: 'main', index: 0 }]] },
  'Filter X Unknown': { main: [[{ node: 'Telegram X Aclaracion', type: 'main', index: 0 }]] },
};

const dedicatedBody = { name: dedicatedName, nodes, connections, settings: legacy.settings, staticData: legacy.staticData };
const existingDedicated = (allWorkflows.data || []).find((workflow) => workflow.name === dedicatedName);
const dedicated = existingDedicated
  ? await api(`/workflows/${existingDedicated.id}`, { method: 'PUT', body: JSON.stringify(dedicatedBody) })
  : await api('/workflows', { method: 'POST', body: JSON.stringify(dedicatedBody) });
await api(`/workflows/${dedicated.id}/activate`, { method: 'POST', body: '{}' });

const xNodeNames = new Set([
  'Get Latest X Pending Post', 'Filter X Aprobado', 'Filter X Editar', 'Filter X Rechazado', 'X Publish Gate', 'IF X Publish Enabled',
  'Publish X Approved Post', 'Patch X Publicado', 'Telegram X Publicado', 'Patch X Error', 'Telegram X Error', 'Telegram X Aprobado',
  'Build X Regenerate Prompt', 'Call OpenAI (X regen)', 'Parse X Regen', 'IF X Regen Valido', 'Patch X Nuevo Draft', 'Build X Nuevo Draft Msg',
  'Telegram X Nuevo Draft', 'Patch X Telegram Msg ID', 'Telegram X Error Regen', 'Patch X Rechazado', 'Telegram X Rechazado',
]);
legacy.nodes = legacy.nodes.filter((node) => !xNodeNames.has(node.name));
legacy.connections.Route.main[0] = legacy.connections.Route.main[0].filter((connection) => !xNodeNames.has(connection.node));
for (const name of xNodeNames) delete legacy.connections[name];
legacy.connections['Get Latest Pending Post'] = { main: [[{ node: 'Merge Context', type: 'main', index: 0 }]] };
legacy.nodes.find((node) => node.name === 'Merge Context').parameters.jsCode = `
const ctx = $('Extract & Normalize').first().json;
const li = $('Get Latest Pending Post').all().map((item) => item.json).filter((item) => item?.id && item.estado === 'draft_enviado' && !String(item.draft || '').startsWith('[[WIS_X]]'));
const replyId = ctx.reply_to_message_id ? String(ctx.reply_to_message_id) : null;
const liReply = replyId ? li.find((item) => String(item.telegram_msg_id || '') === replyId) : null;
let post = null;
let ambiguous = false;
if (liReply) post = liReply;
else if (!replyId && li.length === 1) post = li[0];
else if (!replyId && li.length > 1) ambiguous = true;
return [{ json: { ...ctx, post, platform: 'linkedin', ambiguous, reply_matches: !replyId || Boolean(liReply), auto_publish: false } }];`;
legacy.nodes.find((node) => node.name === 'Route').parameters.jsCode = `
const j = $json;
if (j.ambiguous) return [{ json: { ...j, route: 'unknown', ambiguity: true } }];
if (!j.post && j.reply_to_message_id) return [{ json: { ...j, route: 'unknown', reply_mismatch: true } }];
if (!j.post) return [{ json: { ...j, route: 'unknown', no_pending: true } }];
return [{ json: { ...j, route: j.categoria } }];`;
legacy.nodes.find((node) => node.name === 'Telegram Aclaracion').parameters.text = "={{ $json.no_pending ? 'No hay un borrador activo para aprobar: el anterior venció o ya fue procesado. No se publicó nada.' : ($json.reply_mismatch ? 'Ese mensaje no responde al borrador activo. Respondé directamente al último mensaje recibido.' : ($json.ambiguity ? 'Encontré más de un borrador activo. Respondé directamente al mensaje que querés aprobar, editar o descartar.' : 'No entendí la respuesta. Usá OK, editar: <cambios> o no.')) }}";
const legacyBody = { name: legacy.name, nodes: legacy.nodes, connections: legacy.connections, settings: legacy.settings, staticData: legacy.staticData };
await api(`/workflows/${legacyId}`, { method: 'PUT', body: JSON.stringify(legacyBody) });
await api(`/workflows/${legacyId}/deactivate`, { method: 'POST', body: '{}' });
await new Promise((resolve) => setTimeout(resolve, 1000));
await api(`/workflows/${legacyId}/activate`, { method: 'POST', body: '{}' });

console.log(JSON.stringify({ ok: true, dedicated_workflow_id: dedicated.id, dedicated_workflow_active: true, publisher_credential_id: publisherCredential.id, legacy_workflow_id: legacyId, legacy_workflow_active: true, x_removed_from_legacy: true }));
