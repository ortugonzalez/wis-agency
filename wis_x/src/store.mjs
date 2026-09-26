export class SupabaseStore {
  constructor({ url = process.env.SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl = fetch } = {}) {
    if (!url || !serviceRoleKey) throw new Error('Supabase secrets are not configured');
    this.base = url.replace(/\/$/, '');
    this.headers = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
    this.fetchImpl = fetchImpl;
  }

  async call(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    const response = await this.fetchImpl(`${this.base}/rest/v1/${path}`, { method, headers: { ...this.headers, prefer }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`supabase_${response.status}: ${JSON.stringify(json).slice(0, 500)}`);
    return json;
  }

  async claimForPublish(id, now) { return (await this.call('rpc/claim_x_post_for_publish', { method: 'POST', body: { p_pending_post_id: id, p_now: now } }))[0] || null; }
  async getPublishedPart(pendingPostId, sequence) { return (await this.call(`x_publish_attempts?select=*&pending_post_id=eq.${encodeURIComponent(pendingPostId)}&item_sequence=eq.${sequence}&estado=eq.success&limit=1`))[0] || null; }
  async getAttempt(key) { return (await this.call(`x_publish_attempts?select=*&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`))[0] || null; }
  async startAttempt(value) {
    const existing = await this.getAttempt(value.idempotencyKey);
    if (existing?.estado === 'outcome_unknown' || existing?.estado === 'success') return existing;
    if (existing?.id) {
      return (await this.call(`x_publish_attempts?id=eq.${existing.id}`, { method: 'PATCH', body: { estado: 'started', started_at: new Date().toISOString(), completed_at: null } }))[0] || existing;
    }
    return (await this.call('x_publish_attempts', { method: 'POST', body: { ...value, estado: 'started' } }))[0];
  }
  async recordSuccess({ attemptId, pendingPostId, sequence, xPostId, url, response }) {
    await this.call(`x_publish_attempts?id=eq.${attemptId}`, { method: 'PATCH', body: { estado: 'success', x_post_id: xPostId, response_status: response.status, response_body_sanitized: { data: response.data?.data || null }, completed_at: new Date().toISOString() } });
    const pending = (await this.call(`x_posts_pending?select=x_post_ids_json,x_urls_json&id=eq.${pendingPostId}&limit=1`))[0] || {};
    const ids = Array.isArray(pending.x_post_ids_json) ? pending.x_post_ids_json : [];
    const urls = Array.isArray(pending.x_urls_json) ? pending.x_urls_json : [];
    ids[sequence - 1] = xPostId;
    urls[sequence - 1] = url;
    await this.call(`x_posts_pending?id=eq.${pendingPostId}`, { method: 'PATCH', body: { x_post_ids_json: ids, x_urls_json: urls } });
  }
  async recordReconciled({ pendingPostId, sequence, xPostId, url, response }) {
    const attempts = await this.call(`x_publish_attempts?select=id&pending_post_id=eq.${pendingPostId}&item_sequence=eq.${sequence}&limit=1`);
    if (attempts[0]?.id) await this.call(`x_publish_attempts?id=eq.${attempts[0].id}`, { method: 'PATCH', body: { estado: 'success', x_post_id: xPostId, response_status: response.status, response_body_sanitized: { reconciled: true }, completed_at: new Date().toISOString() } });
    const pending = (await this.call(`x_posts_pending?select=x_post_ids_json,x_urls_json&id=eq.${pendingPostId}&limit=1`))[0] || {};
    const ids = Array.isArray(pending.x_post_ids_json) ? pending.x_post_ids_json : [];
    const urls = Array.isArray(pending.x_urls_json) ? pending.x_urls_json : [];
    ids[sequence - 1] = xPostId; urls[sequence - 1] = url;
    await this.call(`x_posts_pending?id=eq.${pendingPostId}`, { method: 'PATCH', body: { x_post_ids_json: ids, x_urls_json: urls } });
  }
  async recordFailure({ attemptId, error }) { await this.call(`x_publish_attempts?id=eq.${attemptId}`, { method: 'PATCH', body: { estado: error?.uncertain ? 'outcome_unknown' : 'error', response_status: error?.status || null, response_body_sanitized: { error: String(error?.message || 'publisher error').slice(0, 500) }, completed_at: new Date().toISOString() } }); }
  async markPendingFailure(id, { estado, error }) { await this.call(`x_posts_pending?id=eq.${id}`, { method: 'PATCH', body: { estado, error_code: error?.status ? `x_http_${error.status}` : 'publisher_error', error_message: String(error?.message || error || '').slice(0, 500) } }); }
  async markPendingPublished(id, urls) { await this.call(`x_posts_pending?id=eq.${id}`, { method: 'PATCH', body: { estado: 'publicado', x_urls_json: urls, published_at: new Date().toISOString() } }); }
}
