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

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!response.ok) throw new Error(`n8n_${response.status}_${path}`);
  return json;
}

const workflowId = 'VT1s1aTNn4y9BZo0';
const workflow = await api(`/workflows/${workflowId}`);
const byName = (name) => workflow.nodes.find((node) => node.name === name);
const telegramCredentials = structuredClone(byName('Telegram X Publisher Trigger')?.credentials);
const supabaseCredentials = structuredClone(byName('Get Latest X Pending Post')?.credentials);
const openAiCredentials = structuredClone(byName('Call OpenAI (X regen)')?.credentials);
if (!telegramCredentials?.telegramApi || !supabaseCredentials?.supabaseApi || !openAiCredentials?.openAiApi) throw new Error('required_credentials_not_found');

const audioNames = [
  'IF Audio to X', 'Telegram X Audio Processing', 'Get X Voice File', 'Transcribe X Voice',
  'Build X Voice Prompt', 'Call OpenAI X Voice', 'Parse X Voice Post', 'IF X Voice Valid', 'Guardar borrador X desde audio',
  'Build X Voice Preview', 'Telegram X Voice Preview', 'Patch X Voice Telegram Msg ID', 'Telegram X Voice Error',
];
workflow.nodes = workflow.nodes.filter((node) => !audioNames.includes(node.name));
for (const name of audioNames) delete workflow.connections[name];

const extract = byName('Extract & Normalize');
const auth = byName('IF Telegram Autorizado');
const pending = byName('Get Latest X Pending Post');
if (!extract || !auth || !pending) throw new Error('dedicated_core_nodes_not_found');

extract.parameters.jsCode = `
const msg = $json.message || {};
const text = String(msg.text || '');
const norm = text.trim().toLowerCase();
const chatId = String(msg.chat?.id || '');
const fromId = String(msg.from?.id || '');
const authorized = chatId === '7512675688' && fromId === '7512675688';
const voiceFile = msg.voice?.file_id || msg.audio?.file_id || null;
const is_voice = Boolean(voiceFile);
const input_type = msg.voice?.file_id ? 'voice' : (msg.audio?.file_id ? 'audio' : 'text');
let categoria = 'unknown';
if (['ok', 'si', 'sí', 'dale'].includes(norm)) categoria = 'aprobado';
else if (norm === 'editar' || norm.startsWith('editar:') || norm.startsWith('editar :')) categoria = 'editar';
else if (['no', 'borrar', 'borralo', 'borrarlo', 'rechazar', 'cancelar', 'descartar'].includes(norm)) categoria = 'rechazado';
else if (norm === 'hilo') categoria = 'hilo';
else if (norm === 'corto') categoria = 'corto';
const feedback = categoria === 'editar' ? text.split(':').slice(1).join(':').trim() : null;
return [{ json: { texto_original: text, categoria, feedback, authorized, chat_id: chatId, user_id: fromId, is_voice, input_type, audio_file_id: voiceFile, reply_to_message_id: msg.reply_to_message?.message_id || null } }];`;

const audioIf = {
  id: 'x-dedicated-if-audio-20260829', name: 'IF Audio to X', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [440, 260],
  parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'x-audio-input', leftValue: '={{$json.is_voice}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} },
};
const processing = {
  id: 'x-dedicated-audio-processing-20260829', name: 'Telegram X Audio Processing', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [700, 120],
  parameters: { operation: 'sendMessage', chatId: '={{$json.chat_id}}', text: 'Recibí el audio. Lo paso a texto y armo un borrador para que lo revises.', additionalFields: {} }, credentials: telegramCredentials, continueOnFail: true,
};
const getFile = {
  id: 'x-dedicated-get-voice-file-20260829', name: 'Get X Voice File', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [940, 120],
  parameters: { resource: 'file', operation: 'get', fileId: "={{ $('Extract & Normalize').first().json.audio_file_id }}", download: true, additionalFields: { mimeType: 'audio/ogg' } }, credentials: telegramCredentials, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000, continueOnFail: true,
};
const transcribe = {
  id: 'x-dedicated-transcribe-voice-20260829', name: 'Transcribe X Voice', type: '@n8n/n8n-nodes-langchain.openAi', typeVersion: 1.8, position: [1180, 120],
  parameters: { resource: 'audio', operation: 'transcribe', binaryPropertyName: 'data', options: { language: 'es', temperature: 0 } }, credentials: openAiCredentials, retryOnFail: true, maxTries: 2, waitBetweenTries: 1500, continueOnFail: true,
};
const buildPrompt = {
  id: 'x-dedicated-build-voice-prompt-20260829', name: 'Build X Voice Prompt', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1420, 120],
  parameters: { jsCode: `
const transcript = String($json.text || $json.output || $json.content || '').trim();
const prompt = [
  'Convertí la idea de este audio en una publicación única para X en español rioplatense.',
  'El tema tiene que ser el trabajo externo de WIS con empresas y PyMEs: ordenar cómo se trabaja, detectar tareas repetidas, revisar errores, probar cambios, integrar herramientas o decidir qué no conviene automatizar.',
  'Escribí como Ortu le hablaría a su papá o a un amigo: casero, directo, argentino y con voseo. Que parezca un mensaje de WhatsApp bien escrito, no una publicación de consultora ni un texto perfecto de IA.',
  'Una sola idea. Primera frase con tensión o curiosidad real. Después, una explicación corta y una enseñanza concreta para alguien que lleva un negocio. Preferí 250-450 caracteres; máximo 700 si el audio necesita más. No vendas, no pidas clientes, no uses hashtags, emojis ni links.',
  'No inventes clientes, rubros, métricas, resultados, fechas ni experiencias que no estén en el audio. Si la idea está incompleta, generalizá sin agregar datos.',
  'No menciones X, Twitter, Telegram, n8n, bots, publicaciones ni este flujo. Devolvé únicamente JSON válido con la forma {"post":"..."}.',
  '', 'TRANSCRIPCIÓN DEL AUDIO:', transcript,
].join(String.fromCharCode(10));
return [{ json: { prompt, transcript, chat_id: $('Extract & Normalize').first().json.chat_id, user_id: $('Extract & Normalize').first().json.user_id } }];` },
};
const callOpenAi = {
  id: 'x-dedicated-openai-voice-20260829', name: 'Call OpenAI X Voice', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1660, 120],
  parameters: { method: 'POST', url: 'https://api.openai.com/v1/chat/completions', sendHeaders: true, headerParameters: { parameters: [{ name: 'content-type', value: 'application/json' }] }, options: { response: { response: { responseFormat: 'json' } } }, sendBody: true, specifyBody: 'json', jsonBody: '={{ { model: "gpt-4o-mini", messages: [ { role: "user", content: $json.prompt } ], temperature: 0.35 } }}', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi' }, credentials: openAiCredentials, retryOnFail: true, maxTries: 2, waitBetweenTries: 1500, continueOnFail: true,
};
const parse = {
  id: 'x-dedicated-parse-voice-20260829', name: 'Parse X Voice Post', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1900, 120],
  parameters: { jsCode: `
const previous = $('Build X Voice Prompt').first().json;
try {
  const raw = $json?.choices?.[0]?.message?.content;
  const cleaned = String(raw || '').replace(/\\x60\\x60\\x60json\\s*/gi, '').replace(/\\x60\\x60\\x60/g, '').trim();
  const parsed = JSON.parse(cleaned.match(/\\{[\\s\\S]*\\}/)?.[0] || cleaned);
  let post = String(parsed.post || '').replace(/\\\\n/g, '\\n').replace(/\\\\r/g, '').replace(/[^\\S\\r\\n]+/g, ' ').replace(/\\n{3,}/g, '\\n\\n').trim();
  if (post.length > 1400) post = post.slice(0, 1397).replace(/\\s+\\S*$/, '').trim() + '…';
  if (!post) throw new Error('audio_post_empty');
  return [{ json: { voice_ok: true, post, estimated_length: post.length, transcript: previous.transcript, chat_id: previous.chat_id, user_id: previous.user_id } }];
} catch (error) {
  return [{ json: { voice_ok: false, error: 'voice_post_invalid', detail: String(error.message).slice(0, 300), chat_id: previous.chat_id, user_id: previous.user_id } }];
}` },
};
const validIf = {
  id: 'x-dedicated-if-voice-valid-20260829', name: 'IF X Voice Valid', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [2140, 120],
  parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{ id: 'x-voice-valid', leftValue: '={{$json.voice_ok}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} },
};
const save = {
  id: 'x-dedicated-save-voice-draft-20260829', name: 'Guardar borrador X desde audio', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [2380, 120],
  parameters: { operation: 'create', tableId: 'posts_pending', fieldsUi: { fieldValues: [
    { fieldId: 'draft', fieldValue: "={{ '[[WIS_X]] ' + $json.post }}" },
    { fieldId: 'version', fieldValue: '1' },
    { fieldId: 'estado', fieldValue: 'draft_enviado' },
    { fieldId: 'telegram_chat_id', fieldValue: '={{ $json.chat_id }}' },
    { fieldId: 'telegram_user_id', fieldValue: '={{ $json.user_id }}' },
    { fieldId: 'feedback_ortu', fieldValue: "={{ 'Entrada por audio. Transcripción: ' + String($json.transcript || '').slice(0, 2000) }}" },
  ] } }, credentials: supabaseCredentials,
};
const preview = {
  id: 'x-dedicated-build-voice-preview-20260829', name: 'Build X Voice Preview', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2620, 120],
  parameters: { jsCode: `
const post = $('Parse X Voice Post').first().json;
return [{ json: { texto: 'BORRADOR PARA X\\n\\nLo armé a partir de tu audio:\\n\\n' + post.post + '\\n\\nCaracteres: ' + post.estimated_length + '/1400\\n\\nRespondé OK para publicar en X.\\nEDITAR: <cambios>\\nNO o BORRAR para descartar.' } }];` },
};
const sendPreview = {
  id: 'x-dedicated-telegram-voice-preview-20260829', name: 'Telegram X Voice Preview', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [2860, 120],
  parameters: { operation: 'sendMessage', chatId: "={{ $('Parse X Voice Post').first().json.chat_id }}", text: '={{$json.texto}}', additionalFields: {} }, credentials: telegramCredentials,
};
const patchMessage = {
  id: 'x-dedicated-patch-voice-message-20260829', name: 'Patch X Voice Telegram Msg ID', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [3100, 120],
  parameters: { operation: 'update', tableId: 'posts_pending', filterType: 'manual', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Guardar borrador X desde audio').first().json.id }}" }] }, fieldsUi: { fieldValues: [{ fieldId: 'telegram_msg_id', fieldValue: '={{ String($json.result.message_id) }}' }] } }, credentials: supabaseCredentials,
};
const errorTelegram = {
  id: 'x-dedicated-telegram-voice-error-20260829', name: 'Telegram X Voice Error', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [2140, 300],
  parameters: { operation: 'sendMessage', chatId: '={{$json.chat_id || "7512675688"}}', text: 'No pude interpretar ese audio. Probá mandarlo de nuevo o escribime la idea por texto.', additionalFields: {} }, credentials: telegramCredentials,
};

workflow.nodes.push(audioIf, processing, getFile, transcribe, buildPrompt, callOpenAi, parse, validIf, save, preview, sendPreview, patchMessage, errorTelegram);
workflow.connections['IF Telegram Autorizado'] = { main: [[{ node: 'IF Audio to X', type: 'main', index: 0 }], []] };
workflow.connections['IF Audio to X'] = { main: [[{ node: 'Telegram X Audio Processing', type: 'main', index: 0 }], [{ node: 'Get Latest X Pending Post', type: 'main', index: 0 }]] };
workflow.connections['Telegram X Audio Processing'] = { main: [[{ node: 'Get X Voice File', type: 'main', index: 0 }]] };
workflow.connections['Get X Voice File'] = { main: [[{ node: 'Transcribe X Voice', type: 'main', index: 0 }]] };
workflow.connections['Transcribe X Voice'] = { main: [[{ node: 'Build X Voice Prompt', type: 'main', index: 0 }]] };
workflow.connections['Build X Voice Prompt'] = { main: [[{ node: 'Call OpenAI X Voice', type: 'main', index: 0 }]] };
workflow.connections['Call OpenAI X Voice'] = { main: [[{ node: 'Parse X Voice Post', type: 'main', index: 0 }]] };
workflow.connections['Parse X Voice Post'] = { main: [[{ node: 'IF X Voice Valid', type: 'main', index: 0 }]] };
workflow.connections['IF X Voice Valid'] = { main: [[{ node: 'Guardar borrador X desde audio', type: 'main', index: 0 }], [{ node: 'Telegram X Voice Error', type: 'main', index: 0 }]] };
workflow.connections['Guardar borrador X desde audio'] = { main: [[{ node: 'Build X Voice Preview', type: 'main', index: 0 }]] };
workflow.connections['Build X Voice Preview'] = { main: [[{ node: 'Telegram X Voice Preview', type: 'main', index: 0 }]] };
workflow.connections['Telegram X Voice Preview'] = { main: [[{ node: 'Patch X Voice Telegram Msg ID', type: 'main', index: 0 }]] };

const saved = await api(`/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify({ name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings, staticData: workflow.staticData }) });
if (!saved.active) await api(`/workflows/${workflowId}/activate`, { method: 'POST', body: '{}' });
console.log(JSON.stringify({ ok: true, workflow_id: workflowId, active: true, added: audioNames, transcription: 'OpenAI audio / es', approval_required: true }));
