import { idempotencyKey, requestFingerprint, validatePosts } from './text.mjs';
import { XApiError } from './x-api.mjs';

export async function publishApproved({ pendingPostId, posts, username, store, api, dryRun = false, now = new Date() }) {
  const checked = validatePosts(posts);
  if (!checked.valid) return { ok: false, estado: 'error', error_code: 'invalid_text', error_message: checked.reason, posts: checked.posts };
  if (dryRun) {
    return { ok: true, dry_run: true, estado: 'dry_run', posts: checked.posts.map((post) => ({ sequence: post.sequence, weighted_length: post.weightedLength })) };
  }
  const claimed = await store.claimForPublish(pendingPostId, now.toISOString());
  if (!claimed) return { ok: false, estado: 'not_publishable', error_code: 'not_approved_or_expired' };
  let previousId = null;
  const urls = [];
  try {
    for (const post of checked.posts) {
      const existing = await store.getPublishedPart(pendingPostId, post.sequence);
      if (existing?.x_post_id) {
        previousId = existing.x_post_id;
        urls.push(publicUrl(username, previousId));
        continue;
      }
      const fingerprint = requestFingerprint(post.text);
      const key = idempotencyKey(pendingPostId, post.sequence, fingerprint);
      const prior = await store.getAttempt(key);
      if (prior?.estado === 'success' && prior.x_post_id) {
        previousId = prior.x_post_id;
        urls.push(publicUrl(username, previousId));
        continue;
      }
      if (prior?.estado === 'outcome_unknown' || prior?.estado === 'started') {
        await store.markPendingFailure(pendingPostId, { estado: 'outcome_unknown', error: new Error('previous_attempt_requires_reconciliation') });
        return { ok: false, estado: 'outcome_unknown', error_code: 'previous_attempt_requires_reconciliation', published_urls: urls };
      }
      const attempt = await store.startAttempt({ pendingPostId, sequence: post.sequence, idempotencyKey: key, requestFingerprint: fingerprint });
      try {
        const response = await api.createPost(post.text, previousId);
        const xPostId = String(response.data?.data?.id || response.data?.id || '');
        if (!xPostId) throw new XApiError('x_success_without_post_id', { status: response.status, body: response.data });
        const url = publicUrl(username, xPostId);
        await store.recordSuccess({ attemptId: attempt.id, pendingPostId, sequence: post.sequence, xPostId, url, response });
        previousId = xPostId;
        urls.push(url);
      } catch (error) {
        const uncertain = Boolean(error?.uncertain) || (error instanceof XApiError && error.uncertain);
        await store.recordFailure({ attemptId: attempt.id, pendingPostId, sequence: post.sequence, estado: uncertain ? 'outcome_unknown' : 'error', error });
        await store.markPendingFailure(pendingPostId, { estado: uncertain ? 'outcome_unknown' : 'error', error });
        return { ok: false, estado: uncertain ? 'outcome_unknown' : (urls.length ? 'partial_failure' : 'error'), error_code: classifyError(error), error_message: safeMessage(error), published_urls: urls };
      }
    }
    await store.markPendingPublished(pendingPostId, urls);
    return { ok: true, estado: 'publicado', urls };
  } catch (error) {
    await store.markPendingFailure(pendingPostId, { estado: 'error', error });
    return { ok: false, estado: 'error', error_code: classifyError(error), error_message: safeMessage(error), published_urls: urls };
  }
}

export async function reconcilePublishedPart({ pendingPostId, sequence, xPostId, username, store, api }) {
  const response = await api.getPost(xPostId);
  const foundId = String(response.data?.data?.id || response.data?.id || '');
  if (foundId !== String(xPostId)) return { ok: false, reconciled: false, error_code: 'post_not_found' };
  const url = publicUrl(username, xPostId);
  await store.recordReconciled({ pendingPostId, sequence, xPostId: String(xPostId), url, response });
  return { ok: true, reconciled: true, sequence, xPostId: String(xPostId), url };
}

function publicUrl(username, id) { return `https://x.com/${encodeURIComponent(username)}/status/${encodeURIComponent(id)}`; }
function classifyError(error) { return error?.status ? `x_http_${error.status}` : (error?.code || 'publisher_error'); }
function safeMessage(error) { return String(error?.message || error || 'unknown error').replace(/bearer\s+\S+/ig, 'bearer [redacted]').replace(/(token|secret|authorization)[=:]\s*\S+/ig, '$1=[redacted]').slice(0, 500); }
