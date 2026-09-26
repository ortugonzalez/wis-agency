import test from 'node:test';
import assert from 'node:assert/strict';
import twitterText from 'twitter-text';
const { parseTweet } = twitterText;
import { normalizeText, validateText, validatePosts, buildTelegramDraft } from '../src/text.mjs';

test('accepts exactly 280 weighted Latin characters', () => {
  const text = 'a'.repeat(280);
  assert.equal(parseTweet(text).weightedLength, 280);
  assert.equal(validateText(text).valid, true);
});

test('rejects 281 weighted characters', () => {
  const result = validateText('a'.repeat(281));
  assert.equal(result.weightedLength, 281);
  assert.equal(result.valid, false);
});

test('counts emoji sequences according to twitter-text', () => {
  const result = validateText('Hola 👨‍👩‍👧‍👦');
  assert.equal(result.valid, true);
  assert.equal(result.weightedLength, parseTweet('Hola 👨‍👩‍👧‍👦').weightedLength);
});

test('normalizes NFC before validating', () => {
  const decomposed = 'cafe\u0301';
  assert.equal(normalizeText(decomposed), 'café');
  assert.equal(validateText(decomposed).text, 'café');
});

test('valid URL is weighted as 23 characters', () => {
  const short = validateText('https://example.com');
  const long = validateText('https://example.com/una/ruta/muy/larga?parametro=123456789');
  assert.equal(short.weightedLength, 23);
  assert.equal(long.weightedLength, 23);
});

test('hashtags count normally and invalid thread parts are rejected', () => {
  assert.equal(validateText('#automatización').valid, true);
  const result = validatePosts([{ sequence: 1, text: 'ok' }, { sequence: 2, text: 'a'.repeat(281) }]);
  assert.equal(result.valid, false);
  assert.equal(result.posts[1].reason, 'weighted_length_exceeded');
});

test('Telegram draft includes format, counts, expiry and commands', () => {
  const message = buildTelegramDraft({ sourceTitle: 'Fuente controlada', sourceUrl: 'https://example.com', format: 'thread', expiresAt: '2026-08-25T15:00:00.000Z', posts: [{ sequence: 1, text: 'Tesis', weightedLength: 5 }, { sequence: 2, text: 'Impacto', weightedLength: 7 }] });
  assert.match(message, /BORRADOR PARA X/);
  assert.match(message, /1\/2/);
  assert.match(message, /Caracteres ponderados: 7/);
  assert.match(message, /EDITAR/);
});
