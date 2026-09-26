#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { writeReport } from './core.mjs';
import { auditTarget, loadTargetConfig } from './runner.mjs';

function usage() {
  console.error('Uso: node src/beta-tester/cli.mjs audit|browser --config <archivo> [--staging] [--out <directorio>]');
  process.exitCode = 2;
}

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const command = process.argv[2];
if (!command || !['audit', 'browser'].includes(command)) usage();
else {
  try {
    const configPath = path.resolve(argument('--config', 'config/beta-tester.wis-x.json'));
    const outDir = path.resolve(argument('--out', command === 'browser' ? 'reports/beta-tester-browser' : 'reports/beta-tester'));
    const target = await loadTargetConfig(configPath);
    if (command === 'browser') target.type = 'browser';
    const report = await auditTarget(target, { configPath, staging: process.argv.includes('--staging') });
    const files = await writeReport(report, outDir);
    console.log(JSON.stringify({ ok: true, auditId: report.auditId, summary: report.summary, ...files }, null, 2));
    process.exitCode = report.summary.bySeverity.critical || report.summary.bySeverity.high ? 1 : 0;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
