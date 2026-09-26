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
const workflowId = 'nEzq5nGzYQ663wXM';

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}:${JSON.stringify(json).slice(0, 500)}`);
  return json;
}

const workflow = await api(`/workflows/${workflowId}`);
const byName = (name) => workflow.nodes.find((node) => node.name === name);
const clone = (sourceName, name, id, patch = {}) => ({ ...structuredClone(byName(sourceName)), ...patch, id, name });
const telegramCredentials = structuredClone(byName('Telegram Aclaracion').credentials);
const supabaseCredentials = structuredClone(byName('Get Latest Pending Post').credentials);
const openAiCredentials = structuredClone(byName('Call OpenAI (regen)').credentials);

const extract = byName('Extract & Normalize');
extract.parameters.jsCode = `
const msg = $json.message || {};
const text = String(msg.text || '');
const norm = text.trim().toLowerCase();
const chatId = String(msg.chat?.id || '');
const fromId = String(msg.from?.id || '');
const authorized = chatId === '7512675688' && fromId === '7512675688';
let categoria = 'unknown';
if (['ok', 'si', 'sí', 'dale'].includes(norm)) categoria = 'aprobado';
else if (norm === 'editar' || norm.startsWith('editar:') || norm.startsWith('editar :')) categoria = 'editar';
else if (['no', 'rechazar', 'cancelar', 'descartar'].includes(norm)) categoria = 'rechazado';
else if (norm === 'hilo') categoria = 'hilo';
else if (norm === 'corto') categoria = 'corto';
const feedback = categoria === 'editar' ? text.split(':').slice(1).join(':').trim() : null;
return [{ json: { texto_original: text, categoria, feedback, authorized, reply_to_message_id: msg.reply_to_message?.message_id || null } }];`;

const linkedInQuery = byName('Get Latest Pending Post');
linkedInQuery.alwaysOutputData = true;
linkedInQuery.parameters.filters.conditions = [
  { keyName: 'estado', condition: 'eq', keyValue: 'draft_enviado' },
  { keyName: 'noticia_id', condition: 'neq', keyValue: '0' },
];

const xQuery = clone('Get Latest Pending Post', 'Get Latest X Pending Post', 'x-get-latest-pending-20260825', {
  alwaysOutputData: true,
  parameters: {
    operation: 'getAll',
    tableId: 'posts_pending',
    returnAll: true,
    filterType: 'manual',
    filters: { conditions: [{ keyName: 'estado', condition: 'eq', keyValue: 'draft_enviado' }] },
    sort: { property: [{ field: 'created_at', direction: 'DESC' }] },
  },
  position: [720, 40],
});

const merge = byName('Merge Context');
merge.parameters.jsCode = `
const ctx = $('Extract & Normalize').first().json;
const cfg = $('Parse Config Inbound').first().json;
const marker = '[[WIS_X]]';
const li = $('Get Latest Pending Post').all().map((item) => item.json).filter((item) => item?.id && item.estado === 'draft_enviado' && !String(item.draft || '').startsWith(marker));
const xp = $('Get Latest X Pending Post').all().map((item) => item.json).filter((item) => item?.id && item.estado === 'draft_enviado' && String(item.draft || '').startsWith(marker));
const replyId = ctx.reply_to_message_id ? String(ctx.reply_to_message_id) : null;
const xReply = replyId ? xp.find((item) => String(item.telegram_msg_id || '') === replyId) : null;
const liReply = replyId ? li.find((item) => String(item.telegram_msg_id || '') === replyId) : null;
let post = null;
let platform = null;
let ambiguous = false;
if (xReply && !liReply) { post = xReply; platform = 'x'; }
else if (liReply && !xReply) { post = liReply; platform = 'linkedin'; }
else if (xReply && liReply) { ambiguous = true; }
else if (!replyId && xp.length === 1 && li.length === 0) { post = xp[0]; platform = 'x'; }
else if (!replyId && li.length === 1 && xp.length === 0) { post = li[0]; platform = 'linkedin'; }
else if (!replyId && (xp.length > 0 || li.length > 0)) { ambiguous = true; }
return [{ json: { ...ctx, post, platform, ambiguous, reply_matches: !replyId || Boolean(xReply || liReply), auto_publish: cfg.AUTO_PUBLISH === 'true' } }];`;

const route = byName('Route');
route.parameters.jsCode = `
const j = $json;
if (j.ambiguous) return [{ json: { ...j, route: 'unknown', ambiguity: true } }];
if (!j.post) return [{ json: { ...j, route: 'unknown', no_pending: true } }];
if (!j.reply_matches) return [{ json: { ...j, route: 'unknown', reply_mismatch: true } }];
const prefix = j.platform === 'x' ? 'x_' : '';
return [{ json: { ...j, route: prefix + j.categoria } }];`;

const xApprove = clone('Filter: Aprobado', 'Filter X Aprobado', 'x-filter-approved-20260825', { position: [980, -360], parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, combinator: 'and', conditions: [{ id: 'x-approved', leftValue: '={{$json.route}}', rightValue: 'x_aprobado', operator: { type: 'string', operation: 'equals' } }] }, options: {} } });
const xEdit = clone('Filter: Editar', 'Filter X Editar', 'x-filter-edit-20260825', { position: [980, -180], parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, combinator: 'and', conditions: [{ id: 'x-edit', leftValue: '={{$json.route}}', rightValue: 'x_editar', operator: { type: 'string', operation: 'equals' } }] }, options: {} } });
const xReject = clone('Filter: Rechazado', 'Filter X Rechazado', 'x-filter-reject-20260825', { position: [980, 320], parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, combinator: 'and', conditions: [{ id: 'x-reject', leftValue: '={{$json.route}}', rightValue: 'x_rechazado', operator: { type: 'string', operation: 'equals' } }] }, options: {} } });

const xPatchApproved = clone('Patch estado=aprobado', 'Patch X Aprobado', 'x-patch-approved-20260825', { position: [1220, -360], credentials: supabaseCredentials, parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '={{$json.post.id}}' }] }, fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'aprobado' }] } } });
const xPublishGate = { id: 'x-publish-gate-20260825', name: 'X Publish Gate', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1460, -480], parameters: { jsCode: `const enabled = true; return [{json:{...$json, x_publish_enabled: enabled, deployment_mode: 'production'}}];` } };
const xPublishIf = clone('IF Auto Publish', 'IF X Publish Enabled', 'x-if-publish-enabled-20260825', { position: [1700, -360], parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'x-publish-enabled', leftValue: '={{$json.x_publish_enabled}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } });
const xPublish = { id: 'x-publish-api-20260825', name: 'Publish X Approved Post', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1940, -440], onError: 'continueErrorOutput', parameters: { method: 'POST', url: 'https://api.x.com/2/tweets', sendBody: true, specifyBody: 'json', jsonBody: "={{ { text: String($('Route').first().json.post.draft || '').replace(/^\\[\\[WIS_X\\]\\]\\s*/, '').replace(/\\\\n/g, String.fromCharCode(10)).replace(/\\\\r/g, '') } }}", authentication: 'predefinedCredentialType', nodeCredentialType: 'twitterOAuth2Api', options: {} }, credentials: { twitterOAuth2Api: { name: 'X account' } } };
const xPatchPublished = { id: 'x-patch-published-20260825', name: 'Patch X Publicado', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [2180, -440], parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Route').first().json.post.id }}" }] }, fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'publicado' }, { fieldId: 'publicado_url', fieldValue: "={{ 'https://x.com/ortugonzalez3/status/' + $json.data.id }}" }, { fieldId: 'publicado_at', fieldValue: '={{ new Date().toISOString() }}' }] } }, credentials: supabaseCredentials };
const xPublishedTelegram = { id: 'x-telegram-published-20260825', name: 'Telegram X Publicado', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [2420, -440], parameters: { chatId: '7512675688', text: "={{ 'Publicado correctamente en X: https://x.com/ortugonzalez3/status/' + $json.data.id }}", additionalFields: {} }, credentials: telegramCredentials };
const xPatchError = { id: 'x-patch-error-20260825', name: 'Patch X Error', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [2180, -520], parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Route').first().json.post.id }}" }] }, fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'error' }, { fieldId: 'feedback_ortu', fieldValue: "={{ String($json.error?.message || 'x_publish_error').slice(0, 500) }}" }] } }, credentials: supabaseCredentials };
const xErrorTelegram = { id: 'x-telegram-error-20260825', name: 'Telegram X Error', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [2420, -520], parameters: { chatId: '7512675688', text: 'No pude publicar en X. El borrador quedó marcado con error y no voy a reintentarlo a ciegas.', additionalFields: {} }, credentials: telegramCredentials };
const xApprovedTelegram = { id: 'x-telegram-approved-20260825', name: 'Telegram X Aprobado', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [1460, -360], parameters: { chatId: '7512675688', text: 'Aprobación recibida para X. Publicando ahora…', additionalFields: {} }, credentials: telegramCredentials };

const xBuildPrompt = { id: 'x-build-regenerate-20260825', name: 'Build X Regenerate Prompt', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1220, -180], parameters: { jsCode: `
const j = $('Route').first().json;
const previous = String(j.post.draft || '').replace(/^\[\[WIS_X\]\]\s*/, '');
const feedback = j.feedback || 'Revisá el texto y mejoralo manteniendo la idea principal.';
const prompt = [
  'Reescribí una publicación única para X en español rioplatense.',
  'Máximo 280 caracteres ponderados. No uses emojis ni links.',
  'El usuario quiere compartir experiencias sobre automatización con lenguaje natural.',
  'No menciones LinkedIn. No vendas servicios. Aportá una idea clara y entendible.',
  'Devolvé únicamente JSON con la forma {"post":"..."}.',
  '', 'PUBLICACIÓN ANTERIOR:', previous, '', 'CAMBIOS PEDIDOS:', feedback,
].join('\\n');
return [{ json: { prompt, post_id: j.post.id, version_anterior: Number(j.post.version || 1) } }];` } };
const xOpenAi = clone('Call OpenAI (regen)', 'Call OpenAI (X regen)', 'x-call-openai-regen-20260825', { position: [1460, -180], credentials: openAiCredentials, parameters: { ...structuredClone(byName('Call OpenAI (regen)').parameters), jsonBody: '={{ { model: "gpt-4o-mini", messages: [ { role: "user", content: $json.prompt } ], temperature: 0.45 } }}' } });
const xParse = { id: 'x-parse-regen-20260825', name: 'Parse X Regen', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1700, -180], parameters: { jsCode: `
const prev = $('Build X Regenerate Prompt').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  const cleaned = String(raw || '').replace(/\\x60\\x60\\x60json\\s*/gi, '').replace(/\\x60\\x60\\x60/g, '').trim();
  const parsed = JSON.parse(cleaned.match(/\\{[\\s\\S]*\\}/)?.[0] || cleaned);
  const post = String(parsed.post || '').trim();
  if (!post || post.length > 280) throw new Error('post vacío o supera 280 caracteres');
  return [{ json: { regen_ok: true, post, estimated_length: post.length, post_id: prev.post_id, version_nueva: prev.version_anterior + 1 } }];
} catch (error) {
  return [{ json: { regen_ok: false, post_id: prev.post_id, error: 'x_regen_invalid', detail: String(error.message).slice(0, 300) } }];
}` } };
const xRegenIf = clone('IF Regen Valido', 'IF X Regen Valido', 'x-if-regen-valid-20260825', { position: [1940, -180], parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'x-regen-ok', leftValue: '={{$json.regen_ok}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } });
const xPatchDraft = { id: 'x-patch-new-draft-20260825', name: 'Patch X Nuevo Draft', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [2180, -260], parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '={{$json.post_id}}' }] }, fieldsUi: { fieldValues: [{ fieldId: 'draft', fieldValue: "={{ '[[WIS_X]] ' + $json.post }}" }, { fieldId: 'version', fieldValue: '={{$json.version_nueva}}' }, { fieldId: 'estado', fieldValue: 'draft_enviado' }, { fieldId: 'feedback_ortu', fieldValue: "={{ $('Route').first().json.feedback }}" }] } }, credentials: supabaseCredentials };
const xBuildMsg = { id: 'x-build-new-draft-msg-20260825', name: 'Build X Nuevo Draft Msg', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2420, -260], parameters: { jsCode: `const j = $('Parse X Regen').first().json; return [{json:{texto: 'BORRADOR PARA X\\n\\nFormato: publicación única\\n\\n' + j.post + '\\n\\nCaracteres verificados: ' + j.estimated_length + '/280\\n\\nRespondé OK para publicar en X.\\nEDITAR: <cambios>\\nNO para descartar.'}}];` } };
const xTelegramDraft = { id: 'x-telegram-new-draft-20260825', name: 'Telegram X Nuevo Draft', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [2660, -260], parameters: { chatId: '7512675688', text: '={{$json.texto}}', additionalFields: {} }, credentials: telegramCredentials };
const xPatchMsgId = { id: 'x-patch-telegram-msg-20260825', name: 'Patch X Telegram Msg ID', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [2900, -260], parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Parse X Regen').first().json.post_id }}" }] }, fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] } }, credentials: supabaseCredentials };
const xRegenError = { id: 'x-telegram-regen-error-20260825', name: 'Telegram X Error Regen', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [2180, -80], parameters: { chatId: '7512675688', text: 'No pude regenerar el borrador X con esos cambios. No se modificó el original. Podés probar con instrucciones más concretas.', additionalFields: {} }, credentials: telegramCredentials };

const xPatchRejected = clone('Patch Rechazado', 'Patch X Rechazado', 'x-patch-rejected-20260825', { position: [1220, 320], credentials: supabaseCredentials, parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '={{$json.post.id}}' }] }, fieldsUi: { fieldValues: [{ fieldId: 'estado', fieldValue: 'rechazado' }] } } });
const xRejectedTelegram = { id: 'x-telegram-rejected-20260825', name: 'Telegram X Rechazado', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [1460, 320], parameters: { chatId: '7512675688', text: 'Borrador de X descartado. No se publicó nada.', additionalFields: {} }, credentials: telegramCredentials };

const xNodes = [xQuery, xApprove, xEdit, xReject, xPatchApproved, xPublishGate, xPublishIf, xPublish, xPatchPublished, xPublishedTelegram, xPatchError, xErrorTelegram, xApprovedTelegram, xBuildPrompt, xOpenAi, xParse, xRegenIf, xPatchDraft, xBuildMsg, xTelegramDraft, xPatchMsgId, xRegenError, xPatchRejected, xRejectedTelegram];
const xNames = new Set(xNodes.map((node) => node.name));
workflow.nodes = workflow.nodes.filter((node) => !xNames.has(node.name));
workflow.connections.Route.main[0] = workflow.connections.Route.main[0].filter((connection) => !xNames.has(connection.node));
workflow.nodes.push(...xNodes);
workflow.connections['Get Latest Pending Post'] = { main: [[{ node: 'Get Latest X Pending Post', type: 'main', index: 0 }]] };
workflow.connections['Get Latest X Pending Post'] = { main: [[{ node: 'Merge Context', type: 'main', index: 0 }]] };
workflow.connections.Route.main[0].push(
  { node: 'Filter X Aprobado', type: 'main', index: 0 },
  { node: 'Filter X Editar', type: 'main', index: 0 },
  { node: 'Filter X Rechazado', type: 'main', index: 0 },
);
workflow.connections['Filter X Aprobado'] = { main: [[{ node: 'Patch X Aprobado', type: 'main', index: 0 }]] };
workflow.connections['Patch X Aprobado'] = { main: [[{ node: 'X Publish Gate', type: 'main', index: 0 }]] };
workflow.connections['X Publish Gate'] = { main: [[{ node: 'IF X Publish Enabled', type: 'main', index: 0 }]] };
workflow.connections['IF X Publish Enabled'] = { main: [[{ node: 'Publish X Approved Post', type: 'main', index: 0 }], [{ node: 'Telegram X Aprobado', type: 'main', index: 0 }]] };
workflow.connections['Publish X Approved Post'] = { main: [[{ node: 'Patch X Publicado', type: 'main', index: 0 }], [{ node: 'Patch X Error', type: 'main', index: 0 }]] };
workflow.connections['Patch X Publicado'] = { main: [[{ node: 'Telegram X Publicado', type: 'main', index: 0 }]] };
workflow.connections['Patch X Error'] = { main: [[{ node: 'Telegram X Error', type: 'main', index: 0 }]] };
workflow.connections['Filter X Editar'] = { main: [[{ node: 'Build X Regenerate Prompt', type: 'main', index: 0 }]] };
workflow.connections['Build X Regenerate Prompt'] = { main: [[{ node: 'Call OpenAI (X regen)', type: 'main', index: 0 }]] };
workflow.connections['Call OpenAI (X regen)'] = { main: [[{ node: 'Parse X Regen', type: 'main', index: 0 }]] };
workflow.connections['Parse X Regen'] = { main: [[{ node: 'IF X Regen Valido', type: 'main', index: 0 }]] };
workflow.connections['IF X Regen Valido'] = { main: [[{ node: 'Patch X Nuevo Draft', type: 'main', index: 0 }], [{ node: 'Telegram X Error Regen', type: 'main', index: 0 }]] };
workflow.connections['Patch X Nuevo Draft'] = { main: [[{ node: 'Build X Nuevo Draft Msg', type: 'main', index: 0 }]] };
workflow.connections['Build X Nuevo Draft Msg'] = { main: [[{ node: 'Telegram X Nuevo Draft', type: 'main', index: 0 }]] };
workflow.connections['Telegram X Nuevo Draft'] = { main: [[{ node: 'Patch X Telegram Msg ID', type: 'main', index: 0 }]] };
workflow.connections['Filter X Rechazado'] = { main: [[{ node: 'Patch X Rechazado', type: 'main', index: 0 }]] };
workflow.connections['Patch X Rechazado'] = { main: [[{ node: 'Telegram X Rechazado', type: 'main', index: 0 }]] };

const clarification = byName('Telegram Aclaracion');
clarification.parameters.text = "={{ $json.platform === 'x' ? ($json.ambiguity ? 'Encontré más de un borrador activo. Respondé directamente al mensaje de X que querés aprobar, editar o descartar.' : ($json.no_pending ? 'No encontré un borrador vigente de X asociado a este mensaje.' : 'No entendí la respuesta para X. Usá OK, EDITAR: <cambios> o NO.')) : ($json.no_pending ? 'No hay un borrador activo para aprobar: el anterior venció o ya fue procesado. No se publicó nada.' : ($json.reply_mismatch ? 'Ese OK no responde al borrador activo. Respondé directamente al último mensaje recibido.' : 'No entendí la respuesta. Usá OK, editar: <cambios> o no.')) }}";

const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings, staticData: workflow.staticData };
const saved = await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(body) });
console.log(JSON.stringify({ ok: true, workflow_id: saved.id, workflow_name: saved.name, active: saved.active, added: ['Get Latest X Pending Post', 'Filter X Aprobado', 'Filter X Editar', 'Filter X Rechazado', 'X edit/regenerate path', 'X reject path'] }));
