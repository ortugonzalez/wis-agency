import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWriterPrompt, parseWriterResponse } from '../src/writer.mjs';
import { correlatePending, parseTelegramUpdate, TELEGRAM_CONFIRMATIONS } from '../src/telegram.mjs';

test('writer parser recalculates weighted length instead of trusting the model', () => {
  const result = parseWriterResponse(JSON.stringify({ platform: 'x', format: 'single', source_title: 'Fuente', source_url: 'https://example.com', angle: 'negocio', posts: [{ sequence: 1, text: 'Una idea concreta para vender mejor.', weighted_length: 999 }] }));
  assert.equal(result.posts[0].weighted_length, 36);
  assert.equal(result.posts[0].valid, true);
});

test('writer rejects LinkedIn payloads and invalid threads', () => {
  assert.throws(() => parseWriterResponse(JSON.stringify({ platform: 'linkedin', format: 'single', posts: [{ sequence: 1, text: 'x' }] })), /wrong_platform/);
  assert.throws(() => parseWriterResponse(JSON.stringify({ platform: 'x', format: 'thread', posts: [{ sequence: 1, text: 'x' }] })), /two_posts/);
});

test('Telegram approval requires exact message correlation when ambiguous', () => {
  const action = parseTelegramUpdate({ message: { text: 'OK', chat: { id: 1 }, from: { id: 2 }, reply_to_message: { message_id: 9 } } }, { chatId: 1, userId: 2 });
  assert.equal(action.action, 'approve');
  assert.equal(action.authorized, true);
  assert.equal(String(correlatePending(action, [{ platform: 'x', estado: 'draft_enviado', telegram_msg_id: 9 }]).telegram_msg_id), '9');
  assert.equal(correlatePending({ ...action, replyToMessageId: null }, [{ platform: 'x', estado: 'draft_enviado' }, { platform: 'x', estado: 'draft_enviado' }]), null);
});

test('Telegram commands and confirmations are explicit', () => {
  for (const [text, action] of [['EDITAR: más comercial', 'edit'], ['NO', 'reject'], ['HILO', 'thread'], ['CORTO', 'short']]) {
    assert.equal(parseTelegramUpdate({ message: { text, chat: { id: 1 }, from: { id: 2 } } }, { chatId: 1, userId: 2 }).action, action);
  }
  assert.match(TELEGRAM_CONFIRMATIONS.published('https://x.com/ortu/status/1'), /Publicado correctamente en X/);
});

test('writer prompt states the X-specific constraints', () => {
  const prompt = buildWriterPrompt({ sourceTitle: 't', sourceUrl: 'u', mode: 'single' });
  assert.match(prompt, /no recortes ni copies/);
  assert.match(prompt, /JSON/);
});
