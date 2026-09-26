import crypto from 'node:crypto';
import twitterText from 'twitter-text';

const { parseTweet } = twitterText;

export const DEFAULT_MAX_WEIGHTED_CHARS = 280;

export function normalizeText(value) {
  if (typeof value !== 'string') throw new TypeError('text must be a string');
  return value.normalize('NFC');
}

export function validateText(value, maxWeightedChars = DEFAULT_MAX_WEIGHTED_CHARS) {
  const text = normalizeText(value);
  const parsed = parseTweet(text);
  const weightedLength = Number(parsed.weightedLength);
  const valid = parsed.valid === true && weightedLength <= maxWeightedChars;
  return {
    text,
    weightedLength,
    valid,
    reason: valid ? null : (weightedLength > maxWeightedChars ? 'weighted_length_exceeded' : 'twitter_text_invalid'),
  };
}

export function validatePosts(posts, maxWeightedChars = DEFAULT_MAX_WEIGHTED_CHARS) {
  if (!Array.isArray(posts) || posts.length < 1) {
    return { valid: false, posts: [], reason: 'posts_required' };
  }
  const checked = posts.map((post, index) => {
    const sequence = Number(post?.sequence ?? index + 1);
    const result = validateText(post?.text, maxWeightedChars);
    return { sequence, ...result };
  });
  const sequences = checked.map((post) => post.sequence);
  const ordered = sequences.every((value, index) => value === index + 1);
  return {
    valid: ordered && checked.every((post) => post.valid),
    posts: checked,
    reason: ordered ? (checked.every((post) => post.valid) ? null : 'invalid_post') : 'sequence_must_start_at_one',
  };
}

export function requestFingerprint(text) {
  return crypto.createHash('sha256').update(normalizeText(text), 'utf8').digest('hex');
}

export function idempotencyKey(pendingPostId, sequence, fingerprint) {
  return `x:${pendingPostId}:${sequence}:${fingerprint.slice(0, 32)}`;
}

export function buildTelegramDraft({ sourceTitle, sourceUrl, format, posts, expiresAt }) {
  const lines = [
    'BORRADOR PARA X',
    '',
    `Fuente: ${sourceTitle || 'sin título'}`,
    sourceUrl || '',
    `Formato: ${format === 'thread' ? 'hilo' : 'publicación única'}`,
    '',
  ];
  for (const post of posts) {
    lines.push(format === 'thread' ? `${post.sequence}/${posts.length}` : 'Texto');
    lines.push(post.text);
    lines.push(`Caracteres ponderados: ${post.weightedLength}`);
    lines.push('');
  }
  lines.push(`Vence: ${new Date(expiresAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
  lines.push('', 'Respondé OK para publicar en X.', 'EDITAR: <instrucciones>', 'NO para descartar.', 'HILO para pedir un hilo.', 'CORTO para pedir una versión más breve.');
  return lines.join('\n');
}
