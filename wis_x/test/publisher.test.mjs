import test from 'node:test';
import assert from 'node:assert/strict';
import { publishApproved } from '../src/publisher.mjs';

function memoryStore({ existing = {}, failAt = null, uncertainAt = null } = {}) {
  const attempts = new Map();
  const parts = new Map(Object.entries(existing).map(([key, value]) => [key, { x_post_id: value }]));
  let state = 'aprobado';
  return {
    attempts, parts, get state() { return state; },
    async claimForPublish() { if (state !== 'aprobado') return null; state = 'publicando'; return { id: 7 }; },
    async getPublishedPart(id, seq) { return parts.get(`${id}:${seq}`) || null; },
    async getAttempt(key) { return attempts.get(key) || null; },
    async startAttempt(input) { const attempt = { id: attempts.size + 1, ...input }; attempts.set(input.idempotencyKey, attempt); return attempt; },
    async recordSuccess({ attemptId, pendingPostId, sequence, xPostId }) { const attempt = [...attempts.values()].find((value) => value.id === attemptId); attempt.estado = 'success'; attempt.x_post_id = xPostId; parts.set(`${pendingPostId}:${sequence}`, { x_post_id: xPostId }); },
    async recordFailure({ attemptId, error }) { const attempt = [...attempts.values()].find((value) => value.id === attemptId); attempt.estado = error.uncertain ? 'outcome_unknown' : 'error'; },
    async markPendingFailure(_, { estado }) { state = estado; },
    async markPendingPublished() { state = 'publicado'; },
    resetApproval() { state = 'aprobado'; },
    failAt, uncertainAt,
  };
}

function fakeApi(store) {
  let nextId = 100;
  let calls = 0;
  return { async createPost(text) {
    const sequence = ++calls;
    if (store.failAt === sequence) { const error = new Error('x_api_403'); error.status = 403; throw error; }
    if (store.uncertainAt === sequence) { const error = new Error('timeout'); error.uncertain = true; throw error; }
    return { status: 201, data: { data: { id: String(nextId++) } } };
  } };
}

test('publishes a single approved post and records URL', async () => {
  const store = memoryStore();
  const result = await publishApproved({ pendingPostId: 7, username: 'ortu', posts: [{ sequence: 1, text: 'Una publicación válida.' }], store, api: fakeApi(store) });
  assert.equal(result.ok, true);
  assert.equal(result.estado, 'publicado');
  assert.match(result.urls[0], /^https:\/\/x\.com\/ortu\/status\//);
});

test('publishes a thread sequentially and resumes only missing parts', async () => {
  const store = memoryStore({ existing: { '7:1': 'already-there' } });
  const result = await publishApproved({ pendingPostId: 7, username: 'ortu', posts: [{ sequence: 1, text: 'Primera parte.' }, { sequence: 2, text: 'Segunda parte.' }], store, api: fakeApi(store) });
  assert.equal(result.ok, true);
  assert.equal(result.urls.length, 2);
  assert.equal(store.parts.get('7:1').x_post_id, 'already-there');
});

test('does not repeat a part after a middle failure', async () => {
  const store = memoryStore({ failAt: 2 });
  const posts = [{ sequence: 1, text: 'Primera parte.' }, { sequence: 2, text: 'Segunda parte.' }, { sequence: 3, text: 'Tercera parte.' }];
  const first = await publishApproved({ pendingPostId: 7, username: 'ortu', posts, store, api: fakeApi(store) });
  assert.equal(first.estado, 'partial_failure');
  assert.equal(store.parts.get('7:1').x_post_id, '100');
  store.failAt = null;
  store.resetApproval();
  const second = await publishApproved({ pendingPostId: 7, username: 'ortu', posts, store, api: fakeApi(store) });
  assert.equal(second.ok, true);
});

test('stops on uncertain outcome and never retries blindly', async () => {
  const store = memoryStore({ uncertainAt: 1 });
  const result = await publishApproved({ pendingPostId: 7, username: 'ortu', posts: [{ sequence: 1, text: 'Puede haber llegado.' }], store, api: fakeApi(store) });
  assert.equal(result.estado, 'outcome_unknown');
  assert.equal(store.state, 'outcome_unknown');
});

test('dry-run never claims or calls the API', async () => {
  const store = memoryStore();
  const result = await publishApproved({ pendingPostId: 7, username: 'ortu', posts: [{ sequence: 1, text: 'No se publica.' }], store, api: { createPost: () => { throw new Error('must not call'); } }, dryRun: true });
  assert.equal(result.dry_run, true);
  assert.equal(store.state, 'aprobado');
});
