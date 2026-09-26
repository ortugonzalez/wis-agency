export const TELEGRAM_CONFIRMATIONS = Object.freeze({
  approvalReceived: 'Recibí tu aprobación. Estoy publicando en X.',
  published: (url) => `Publicado correctamente en X: ${url}`,
  rejected: 'Borrador de X descartado. No se publicó nada.',
  missing: 'No encontré un borrador vigente de X asociado a este mensaje.',
  expired: 'Ese borrador de X ya venció. Voy a necesitar generar uno nuevo.',
  error: (message) => `No pude publicar en X. No voy a reintentarlo a ciegas. Error: ${message}`,
});

export function parseTelegramUpdate(update, { chatId, userId } = {}) {
  const message = update?.message || update?.callback_query?.message || {};
  const callback = update?.callback_query;
  const text = String(message.text || callback?.data || '').trim();
  const normalized = text.toLowerCase();
  let action = 'unknown';
  if (/^(ok|si|sí|dale)$/.test(normalized)) action = 'approve';
  else if (/^editar\s*:/.test(normalized)) action = 'edit';
  else if (/^(no|borrar|bórralo|borrarlo|rechazar|cancelar|descartar)$/.test(normalized)) action = 'reject';
  else if (normalized === 'hilo') action = 'thread';
  else if (normalized === 'corto') action = 'short';
  return {
    action, text, chatId: String(message.chat?.id || callback?.from?.id || ''), userId: String(message.from?.id || callback?.from?.id || ''),
    replyToMessageId: message.reply_to_message?.message_id ? String(message.reply_to_message.message_id) : null,
    callbackId: callback?.id || null,
    authorized: String(message.chat?.id || callback?.message?.chat?.id || '') === String(chatId || '') && String(message.from?.id || callback?.from?.id || '') === String(userId || ''),
  };
}

export function correlatePending(action, candidates) {
  const x = (candidates || []).filter((row) => row.platform === 'x' && ['draft_enviado', 'regenerando'].includes(row.estado));
  if (action.replyToMessageId) {
    return x.find((row) => String(row.telegram_msg_id) === String(action.replyToMessageId)) || null;
  }
  return x.length === 1 ? x[0] : null;
}
