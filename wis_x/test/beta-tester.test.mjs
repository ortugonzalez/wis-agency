import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditHttpTarget, UNICODE_CORPUS } from '../src/beta-tester/adapters.mjs';
import { buildReport, redact, renderHtml } from '../src/beta-tester/core.mjs';
import { auditHttpsUrl, auditN8nExport, exploratoryScenarios } from '../src/beta-tester/rules.mjs';
import { auditTarget } from '../src/beta-tester/runner.mjs';

test('redacts credentials from report data', () => {
  const result = redact({ token: 'Bearer abc', nested: { password: 'secret' }, text: 'authorization=abc' });
  assert.equal(result.token, '[REDACTED]');
  assert.equal(result.nested.password, '[REDACTED]');
  assert.match(result.text, /REDACTED/);
});

test('requires HTTPS outside local mode and rejects credentials in URL', () => {
  assert.equal(auditHttpsUrl('http://example.com', { mode: 'staging' })[0].rule, 'https.required');
  assert.equal(auditHttpsUrl('https://user:pass@example.com', { mode: 'staging' })[0].rule, 'https.credentials_in_url');
  assert.deepEqual(auditHttpsUrl('http://localhost:3000', { mode: 'local' }), []);
});

test('audits n8n exports without activating or executing them', () => {
  const result = auditN8nExport([{ name: 'Demo', active: false, nodes: [
    { name: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: { path: 'demo' } },
    { name: 'Call API', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'http://example.com', method: 'GET' } },
    { name: 'Danger', type: 'n8n-nodes-base.code', parameters: { jsCode: "require('child_process').execSync('id')" } },
  ], connections: { Webhook: { main: [[{ node: 'Call API', type: 'main', index: 0 }]] } } }], { environment: 'staging', contract: { requireExplicitWebhookAuth: true } });
  assert.equal(result.inventory.workflowCount, 1);
  assert.ok(result.findings.some((item) => item.rule === 'n8n.webhook_auth'));
  assert.ok(result.findings.some((item) => item.rule === 'https.required'));
  assert.ok(result.findings.some((item) => item.rule === 'n8n.code_runtime_access'));
});

test('local HTTP audit never performs network calls', async () => {
  const result = await auditHttpTarget({ type: 'http', source: { baseUrl: 'http://localhost:9999' } }, { mode: 'local', allowedHosts: [], timeoutMs: 100 });
  assert.equal(result.inventory.network, 'disabled');
  assert.equal(result.scenarios[0].status, 'blocked');
});

test('exploratory cases include Unicode and duplicate-event coverage', () => {
  const cases = exploratoryScenarios({ type: 'n8n' }, { workflowCount: 1 });
  assert.ok(cases.some((item) => item.id === 'baseline-unicode'));
  assert.ok(cases.some((item) => item.id === 'baseline-duplicate'));
  assert.ok(cases.some((item) => item.id === 'n8n-empty-branch'));
});

test('Unicode corpus includes accents, combining marks, emoji and encoded URLs', () => {
  assert.ok(UNICODE_CORPUS.some((value) => value.includes('áéíóúñü')));
  assert.ok(UNICODE_CORPUS.some((value) => /👩🏽‍💻/.test(value)));
  assert.ok(UNICODE_CORPUS.some((value) => value.includes('é')));
  assert.ok(UNICODE_CORPUS.some((value) => value.includes('%20')));
});

test('audit runner produces a sanitized structured report from local n8n export', async () => {
  const configPath = path.resolve('config/beta-tester.wis-x.json');
  const report = await auditTarget({ type: 'n8n', name: 'fixture', source: { exportPath: 'workflows/wis-x-export.json' }, environment: 'local', rules: ['baseline', 'n8n', 'https', 'encoding'] }, { configPath, staging: false });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.execution.mode, 'local');
  assert.ok(report.inventory.workflowCount >= 1);
  assert.ok(report.summary.scenarios >= 7);
  assert.doesNotMatch(JSON.stringify(report), /Bearer\s+[A-Za-z0-9]/i);
});

test('HTML report is UTF-8 and contains findings and scenarios', async () => {
  const report = buildReport({
    auditId: 'audit-test', target: { name: 'Prueba áéñ 👩🏽‍💻' }, context: { mode: 'local', allowSideEffects: false, allowedHosts: [] },
    findings: [{ id: 'f1', rule: 'encoding', title: '¿Qué pasó?', category: 'encoding', severity: 'low', recommendation: 'Conservar UTF-8' }],
    scenarios: [{ id: 's1', title: 'Unicode', category: 'encoding', status: 'passed', expected: 'Sin corrupción' }], inventory: {}, evidence: [], startedAt: new Date().toISOString(),
  });
  const html = renderHtml(report);
  assert.match(html, /Prueba/);
  assert.match(html, /Qué pasó/);
  assert.match(html, /Unicode/);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'beta-tester-'));
  await fs.writeFile(path.join(directory, 'report.html'), html, 'utf8');
  assert.equal((await fs.readFile(path.join(directory, 'report.html'), 'utf8')).includes('á'), true);
});
