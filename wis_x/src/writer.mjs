import { validatePosts } from './text.mjs';

export function buildWriterPrompt({ sourceTitle, sourceUrl, sourceSummary = '', styleCard = '', corpus = '', mode = 'single' }) {
  return [
    'Escribí para X en español rioplatense, en primera persona, como Ortu.',
    'Redactá desde cero: no recortes ni copies un post de LinkedIn.',
    'Priorizá un gancho, una opinión y una consecuencia comercial concreta.',
    'Sin emojis por defecto, sin HTML, sin Markdown complejo y con cero o un hashtag salvo necesidad real.',
    'La publicación única es el formato predeterminado. Usá hilo sólo si el concepto no entra correctamente, con 2 a 4 partes.',
    'Devolvé exclusivamente JSON con platform, format, source_title, source_url, angle y posts[{sequence,text}]. No inventes hechos.',
    `Modo solicitado: ${mode}.`,
    `Fuente: ${sourceTitle}\nURL: ${sourceUrl}\nResumen: ${sourceSummary}`,
    `Guía de voz:\n${styleCard}`,
    `Corpus de voz:\n${corpus}`,
  ].join('\n\n');
}

export function parseWriterResponse(raw, context = {}) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('writer_empty_response');
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error('writer_invalid_json'); }
  if (parsed.platform !== 'x') throw new Error('writer_wrong_platform');
  if (!['single', 'thread'].includes(parsed.format)) throw new Error('writer_invalid_format');
  if (!Array.isArray(parsed.posts) || parsed.posts.length < 1 || parsed.posts.length > 4) throw new Error('writer_invalid_posts');
  if (parsed.format === 'single' && parsed.posts.length !== 1) throw new Error('single_must_have_one_post');
  if (parsed.format === 'thread' && parsed.posts.length < 2) throw new Error('thread_must_have_two_posts');
  const checked = validatePosts(parsed.posts);
  if (!checked.valid) throw new Error(`writer_text_invalid:${checked.reason}`);
  return {
    platform: 'x', format: parsed.format, source_title: String(parsed.source_title || context.sourceTitle || ''),
    source_url: String(parsed.source_url || context.sourceUrl || ''), angle: String(parsed.angle || ''),
    posts: checked.posts.map(({ sequence, text, weightedLength: weighted_length, valid }) => ({ sequence, text, weighted_length, valid })),
  };
}
