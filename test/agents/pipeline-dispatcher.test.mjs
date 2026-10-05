import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  appendCommandSnapshot,
  JsonPipelineStore,
  MemoryPipelineStore,
  PipelinePlanner,
  splitIntoBatches
} from "../../scripts/pipeline-dispatcher.mjs";

const records = count => Array.from({ length: count }, (_, index) => ({ prospect_key: `p-${index + 1}`, empresa: `Empresa ${index + 1}` }));
const activate = { command_id: "CTRL-1", action: "PIPELINE_ACTIVATE", status: "NEW", payload: { evidence: { schemaVersion: 1, intervalMinutes: 10, batchSize: 25, maxSpecialists: 3, dryRun: true } } };

test("lots never exceed 25", () => {
  assert.deepEqual(splitIntoBatches(records(51)).map(batch => batch.length), [25, 25, 1]);
  assert.throws(() => splitIntoBatches(records(1), 26), /between 1 and 25/);
});

test("dashboard command snapshot parses string evidence and plans criteria-only research", async () => {
  const store = new MemoryPipelineStore();
  await appendCommandSnapshot(store, [
    { commandId: "CTRL-UI", action: "PIPELINE_ACTIVATE", status: "NEW", evidence: JSON.stringify({ schemaVersion: 1, config: { intervalMinutes: 10, batchSize: 25, maxSpecialists: 2, dryRun: true } }) },
    { commandId: "REQ-UI", action: "REQUEST_RESEARCH", status: "NEW", evidence: JSON.stringify({ schemaVersion: 2, quantity: 30, businessType: "hoteles", location: "Argentina" }) }
  ]);
  const planner = new PipelinePlanner({ store });
  const manifest = await planner.plan();
  assert.equal(manifest.maxSpecialists, 2);
  assert.equal(manifest.jobs.length, 2);
  assert.deepEqual(manifest.jobs.map(job => job.requestedCount), [25, 5]);
  assert.ok(manifest.jobs.every(job => job.criteria.businessType === "hoteles"));
  assert.ok(manifest.jobs.every(job => job.records.length === 0));
});

test("planner emits a fenced heartbeat manifest and stops after QA for human approval", async () => {
  let now = Date.parse("2026-10-05T12:00:00Z");
  const store = new MemoryPipelineStore({ commands: [activate, { command_id: "CMD-1", action: "PROCESS_PIPELINE", status: "NEW", payload: { campaignId: "hotels", records: records(51) } }] });
  const planner = new PipelinePlanner({ store, clock: () => now });
  for (const expectedLane of ["RESEARCH", "COPY", "QA"]) {
    let pending = true;
    while (pending) {
      const manifest = await planner.plan();
      assert.ok(manifest.jobs.length <= 3);
      if (manifest.jobs.length === 0) break;
      assert.ok(manifest.jobs.every(job => job.lane === expectedLane));
      await planner.complete(manifest.jobs.map(job => ({ jobId: job.jobId, leaseToken: job.leaseToken, ok: true, records: job.records, evidence: [`${expectedLane} checked`], tests: ["PASS"] })));
      pending = (await store.read()).jobs.some(job => job.lane === expectedLane && job.status === "READY");
      now += 1_000;
    }
  }
  const state = await store.read();
  assert.deepEqual(state.batches.map(batch => batch.records.length), [25, 25, 1]);
  assert.ok(state.batches.every(batch => batch.status === "ESPERANDO_APROBACION"));
  assert.equal(state.commands.find(command => command.command_id === "CMD-1").status, "WAITING_APPROVAL");
  assert.equal(state.outreachQueue.length, 0);
});

test("two dispatchers cannot claim one job and stale completion is fenced", async () => {
  const store = new MemoryPipelineStore({ commands: [activate, { command_id: "CMD-2", status: "NEW", payload: { records: records(1) } }] });
  const a = new PipelinePlanner({ store, owner: "heartbeat-a" });
  const b = new PipelinePlanner({ store, owner: "heartbeat-b" });
  const [first, second] = await Promise.all([a.plan(), b.plan()]);
  assert.equal(first.jobs.length + second.jobs.length, 1);
  const claimed = first.jobs[0] ?? second.jobs[0];
  await a.complete([{ jobId: claimed.jobId, leaseToken: "stale-token", ok: true, records: claimed.records }]);
  let state = await store.read();
  assert.equal(state.jobs.find(job => job.job_id === claimed.jobId).status, "IN_PROGRESS");
  assert.equal(state.events.at(-1).type, "STALE_COMPLETION_REJECTED");
  await a.complete([{ jobId: claimed.jobId, leaseToken: claimed.leaseToken, ok: true, records: claimed.records }]);
  state = await store.read();
  assert.equal(state.jobs.find(job => job.job_id === claimed.jobId).status, "DONE");
});

test("maxSpecialists is a global limit across heartbeat cycles", async () => {
  const store = new MemoryPipelineStore({ commands: [activate, { command_id: "CMD-GLOBAL", status: "NEW", payload: { records: records(100) } }] });
  const planner = new PipelinePlanner({ store, owner: "heartbeat-global" });
  const first = await planner.plan();
  assert.equal(first.jobs.length, 3);
  const second = await planner.plan();
  assert.equal(second.jobs.length, 0);
  assert.equal((await store.read()).jobs.filter(job => job.status === "IN_PROGRESS").length, 3);
  await planner.complete([{ jobId: first.jobs[0].jobId, leaseToken: first.jobs[0].leaseToken, ok: true, records: first.jobs[0].records }]);
  const third = await planner.plan();
  assert.equal(third.jobs.length, 1);
  assert.equal((await store.read()).jobs.filter(job => job.status === "IN_PROGRESS").length, 3);
});

test("expired lease is reclaimed and checkpoint does not duplicate batches", async () => {
  let now = Date.parse("2026-10-05T12:00:00Z");
  const store = new MemoryPipelineStore({ commands: [activate, { command_id: "CMD-3", status: "NEW", payload: { records: records(25) } }] });
  const planner = new PipelinePlanner({ store, owner: "heartbeat", clock: () => now, leaseMs: 1_000 });
  const first = await planner.plan();
  assert.equal(first.jobs.length, 1);
  now += 2_000;
  const reclaimed = await planner.plan();
  assert.equal(reclaimed.jobs.length, 1);
  assert.equal(reclaimed.jobs[0].jobId, first.jobs[0].jobId);
  assert.notEqual(reclaimed.jobs[0].leaseToken, first.jobs[0].leaseToken);
  await planner.complete([{ jobId: reclaimed.jobs[0].jobId, leaseToken: reclaimed.jobs[0].leaseToken, ok: true, records: reclaimed.jobs[0].records }]);
  await planner.ingest();
  const state = await store.read();
  assert.equal(state.batches.length, 1);
  assert.equal(state.jobs.filter(job => job.lane === "RESEARCH").length, 1);
  assert.equal(state.events.filter(item => item.type === "LEASE_RECOVERED").length, 1);
});

test("panic stop prevents planning and safety-critical channel modes cannot be weakened", async () => {
  const store = new MemoryPipelineStore({ commands: [activate, { command_id: "STOP", action: "PIPELINE_PANIC_STOP", status: "NEW" }, { command_id: "CMD-4", status: "NEW", payload: { records: records(1) } }] });
  const planner = new PipelinePlanner({ store });
  assert.equal((await planner.plan()).jobs.length, 0);
  const state = await store.read();
  assert.equal(state.config.panicStop, true);
  assert.equal(state.commands.find(command => command.command_id === "CMD-4").status, "NEW");

  const unsafe = new MemoryPipelineStore({ commands: [{ command_id: "BAD", action: "PIPELINE_UPDATE_CONFIG", status: "NEW", payload: { evidence: { emailMode: "AUTO_SEND" } } }] });
  const unsafePlanner = new PipelinePlanner({ store: unsafe });
  await assert.rejects(() => unsafePlanner.ingest(), /APPROVAL_REQUIRED/);
});

test("file store serializes concurrent command snapshots", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wis-dispatcher-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "state.json");
  const a = new JsonPipelineStore(file);
  const b = new JsonPipelineStore(file);
  await Promise.all([
    appendCommandSnapshot(a, [{ command_id: "A", status: "NEW" }]),
    appendCommandSnapshot(b, [{ command_id: "B", status: "NEW" }])
  ]);
  assert.deepEqual((await a.read()).commands.map(item => item.command_id).sort(), ["A", "B"]);
});

test("file store recovers a dead stale lock but never breaks a live owner lock", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wis-lock-recovery-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "state.json");
  const lock = `${file}.lock`;
  const ownerFile = path.join(lock, "owner.json");
  await fs.mkdir(lock);
  await fs.writeFile(ownerFile, JSON.stringify({ token: "dead", pid: 2147483647, host: os.hostname() }), "utf8");
  const staleAt = new Date(Date.now() - 60_000);
  await fs.utimes(ownerFile, staleAt, staleAt);
  const recovering = new JsonPipelineStore(file, { timeoutMs: 500, retryMs: 5, lockStaleMs: 10 });
  await appendCommandSnapshot(recovering, [{ command_id: "RECOVERED", status: "NEW" }]);
  assert.equal((await recovering.read()).commands[0].command_id, "RECOVERED");

  await fs.mkdir(lock);
  await fs.writeFile(ownerFile, JSON.stringify({ token: "live", pid: process.pid, host: os.hostname() }), "utf8");
  await fs.utimes(ownerFile, staleAt, staleAt);
  const contender = new JsonPipelineStore(file, { timeoutMs: 40, retryMs: 5, lockStaleMs: 10 });
  await assert.rejects(() => appendCommandSnapshot(contender, [{ command_id: "MUST-NOT-WRITE", status: "NEW" }]), /lock timeout/);
  assert.equal(JSON.parse(await fs.readFile(ownerFile, "utf8")).token, "live");
  assert.equal((await recovering.read()).commands.some(command => command.command_id === "MUST-NOT-WRITE"), false);
});

test("send planning remains dry-run and enforces approval, email-first and WhatsApp opt-in", async () => {
  const approval = { approval_id: "APR-1", campaign_id: "camp", batch_id: "batch", channels: ["EMAIL", "WHATSAPP"], message_versions: ["A-v1"], sequences: [1], recipient_limit: 25, expires_at: "2099-01-01T00:00:00Z", decision: "APPROVED" };
  const common = { campaign_id: "camp", batch_id: "batch", sequence: 1, message_version: "A-v1", approval_id: "APR-1", status: "APROBADO" };
  const store = new MemoryPipelineStore({
    config: { enabled: true, dryRun: true },
    approvals: [approval],
    batches: [{ batch_id: "batch", status: "APROBADO", outreach: [
      { ...common, message_id: "email", prospect_key: "p1", channel: "EMAIL", recipient: "ventas@example.com" },
      { ...common, message_id: "wa-ok", prospect_key: "p2", channel: "WHATSAPP", recipient: "+5491100000000", opt_in: { verified: true, source: "prospect initiated", recorded_at: "2098-12-31T12:00:00Z" } },
      { ...common, message_id: "wa-cold", prospect_key: "p3", channel: "WHATSAPP", recipient: "+5491100000001" }
    ] }]
  });
  const planner = new PipelinePlanner({ store });
  const now = "2098-12-31T14:00:00Z";
  const result = await planner.planApprovedOutreach({ contexts: { providerSnapshotLoaded: true, byMessage: {
    email: { now }, "wa-ok": { now, emailInitialSent: true }, "wa-cold": { now, emailInitialSent: true }
  } } });
  assert.deepEqual(result.planned.map(item => item.message_id).sort(), ["email", "wa-ok"]);
  assert.equal(result.blocked.find(item => item.message_id === "wa-cold").reason, "VERIFIED_OPT_IN_REQUIRED");
  assert.equal(result.providerCalls, 0);
  assert.equal((await store.read()).outreachQueue.length, 0);
});
