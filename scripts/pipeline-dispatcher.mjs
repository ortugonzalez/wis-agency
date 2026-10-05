import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createIdempotencyIndex, enqueueCandidate } from "./outreach-engine.mjs";

const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  panicStop: false,
  dryRun: true,
  intervalMinutes: 10,
  batchSize: 25,
  maxSpecialists: 3,
  autoResearch: true,
  autoCopy: true,
  autoQa: true,
  emailMode: "APPROVAL_REQUIRED",
  whatsappMode: "OPTIN_AND_APPROVAL_REQUIRED"
});

const DEFAULT_STATE = Object.freeze({
  version: 1,
  config: DEFAULT_CONFIG,
  commands: [],
  batches: [],
  jobs: [],
  leases: {},
  events: [],
  approvals: [],
  outreachQueue: []
});

export const CONTROL_ACTIONS = Object.freeze([
  "PIPELINE_ACTIVATE",
  "PIPELINE_PAUSE",
  "PIPELINE_RESUME",
  "PIPELINE_PANIC_STOP",
  "PIPELINE_UPDATE_CONFIG"
]);

const JOB_TO_STAGE = Object.freeze({
  RESEARCH: { pending: "NUEVO", active: "RESEARCH_EN_CURSO", success: "RESEARCH_VALIDADO", agent: "prospect-research" },
  COPY: { pending: "RESEARCH_VALIDADO", active: "RESEARCH_VALIDADO", success: "BORRADOR", agent: "outreach-copy" },
  QA: { pending: "BORRADOR", active: "QA", success: "ESPERANDO_APROBACION", agent: "qa-ops" }
});

const clone = value => structuredClone(value);
const makeId = prefix => `${prefix}-${crypto.randomUUID()}`;
const asIso = value => new Date(value).toISOString();

function normalizeState(value = {}) {
  return {
    ...clone(DEFAULT_STATE),
    ...value,
    config: { ...DEFAULT_CONFIG, ...(value.config ?? {}) },
    commands: Array.isArray(value.commands) ? value.commands : [],
    batches: Array.isArray(value.batches) ? value.batches : [],
    jobs: Array.isArray(value.jobs) ? value.jobs : [],
    leases: value.leases && typeof value.leases === "object" ? value.leases : {},
    events: Array.isArray(value.events) ? value.events : [],
    approvals: Array.isArray(value.approvals) ? value.approvals : [],
    outreachQueue: Array.isArray(value.outreachQueue) ? value.outreachQueue : []
  };
}

function event(state, type, now, detail = {}) {
  state.events.push({ event_id: makeId("EVT"), type, timestamp: asIso(now), ...detail });
}

function validateConfig(input) {
  const config = { ...DEFAULT_CONFIG, ...input };
  if (!Number.isInteger(config.intervalMinutes) || config.intervalMinutes < 10) throw new Error("intervalMinutes must be at least 10");
  if (!Number.isInteger(config.batchSize) || config.batchSize < 1 || config.batchSize > 25) throw new Error("batchSize must be between 1 and 25");
  if (!Number.isInteger(config.maxSpecialists) || config.maxSpecialists < 1 || config.maxSpecialists > 3) throw new Error("maxSpecialists must be between 1 and 3");
  if (config.emailMode !== "APPROVAL_REQUIRED") throw new Error("emailMode must remain APPROVAL_REQUIRED");
  if (config.whatsappMode !== "OPTIN_AND_APPROVAL_REQUIRED") throw new Error("whatsappMode must remain OPTIN_AND_APPROVAL_REQUIRED");
  return config;
}

export function splitIntoBatches(records, size = 25) {
  if (!Number.isInteger(size) || size < 1 || size > 25) throw new Error("Batch size must be between 1 and 25");
  const output = [];
  for (let index = 0; index < records.length; index += size) output.push(records.slice(index, index + size));
  return output;
}

export class JsonPipelineStore {
  constructor(file, { retryMs = 20, timeoutMs = 5_000, lockStaleMs = 30_000 } = {}) {
    this.file = path.resolve(file);
    this.lock = `${this.file}.lock`;
    this.lockOwnerFile = path.join(this.lock, "owner.json");
    this.retryMs = retryMs;
    this.timeoutMs = timeoutMs;
    this.lockStaleMs = lockStaleMs;
  }

  async read() {
    try {
      return normalizeState(JSON.parse(await fs.readFile(this.file, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") return normalizeState();
      throw error;
    }
  }

  async transact(mutator) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const started = Date.now();
    const lockToken = makeId("FILELOCK");
    while (true) {
      try {
        await fs.mkdir(this.lock);
        await fs.writeFile(this.lockOwnerFile, JSON.stringify({ token: lockToken, pid: process.pid, host: os.hostname(), created_at: new Date().toISOString() }), "utf8");
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        await this.recoverStaleLock();
        if (Date.now() - started >= this.timeoutMs) throw new Error(`Pipeline state lock timeout: ${this.lock}`);
        await new Promise(resolve => setTimeout(resolve, this.retryMs));
      }
    }
    try {
      const current = await this.read();
      const next = normalizeState((await mutator(clone(current))) ?? current);
      const temporary = `${this.file}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      await fs.rename(temporary, this.file);
      return clone(next);
    } finally {
      try {
        const owner = JSON.parse(await fs.readFile(this.lockOwnerFile, "utf8"));
        if (owner.token === lockToken) await fs.rm(this.lock, { recursive: true, force: true });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }

  async recoverStaleLock() {
    let stat;
    let owner = null;
    try {
      stat = await fs.stat(this.lockOwnerFile);
      owner = JSON.parse(await fs.readFile(this.lockOwnerFile, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        try { stat = await fs.stat(this.lock); } catch (nested) { if (nested.code === "ENOENT") return false; throw nested; }
      } else {
        return false;
      }
    }
    if (Date.now() - stat.mtimeMs <= this.lockStaleMs) return false;
    if (owner?.host === os.hostname() && Number.isInteger(owner.pid) && processIsAlive(owner.pid)) return false;
    try {
      await fs.rm(this.lock, { recursive: true, force: false });
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export class MemoryPipelineStore {
  constructor(initial = {}) {
    this.state = normalizeState(initial);
    this.chain = Promise.resolve();
  }
  async read() {
    await this.chain;
    return clone(this.state);
  }
  async transact(mutator) {
    let result;
    this.chain = this.chain.then(async () => {
      this.state = normalizeState((await mutator(clone(this.state))) ?? this.state);
      result = clone(this.state);
    });
    await this.chain;
    return result;
  }
}

function normalizeCommand(raw) {
  let evidence = raw.evidence;
  if (typeof evidence === "string") {
    try { evidence = JSON.parse(evidence); } catch { evidence = {}; }
  }
  return {
    ...raw,
    command_id: raw.command_id ?? raw.commandId ?? makeId("CMD"),
    action: raw.action ?? "PROCESS_PIPELINE",
    status: raw.status ?? "NEW",
    payload: raw.payload ?? evidence ?? {},
    created_at: raw.created_at ?? new Date().toISOString()
  };
}

export async function appendCommandSnapshot(store, rawCommands) {
  return store.transact(state => {
    const known = new Set(state.commands.map(item => item.command_id));
    for (const raw of rawCommands) {
      const command = normalizeCommand(raw);
      if (!known.has(command.command_id)) {
        state.commands.push(command);
        known.add(command.command_id);
      }
    }
    return state;
  });
}

function createJob(state, batch, lane, now) {
  if (state.jobs.some(job => job.batch_id === batch.batch_id && job.lane === lane)) return;
  state.jobs.push({
    job_id: makeId("JOB"),
    command_id: batch.command_id,
    batch_id: batch.batch_id,
    lane,
    agent: JOB_TO_STAGE[lane].agent,
    status: "READY",
    attempts: 0,
    created_at: asIso(now),
    updated_at: asIso(now)
  });
}

function applyControl(state, command, now) {
  const payload = command.payload?.config ?? command.payload?.evidence ?? command.payload ?? {};
  if (command.action === "PIPELINE_ACTIVATE" || command.action === "PIPELINE_RESUME") {
    state.config = validateConfig({ ...state.config, ...payload, enabled: true, panicStop: false });
  } else if (command.action === "PIPELINE_PAUSE") {
    state.config.enabled = false;
  } else if (command.action === "PIPELINE_PANIC_STOP") {
    state.config.enabled = false;
    state.config.panicStop = true;
  } else if (command.action === "PIPELINE_UPDATE_CONFIG") {
    state.config = validateConfig({ ...state.config, ...payload });
  } else {
    return false;
  }
  command.status = "DONE";
  command.updated_at = asIso(now);
  event(state, "CONTROL_APPLIED", now, { command_id: command.command_id, action: command.action });
  return true;
}

function seedResearch(state, command, now) {
  const records = command.payload?.records ?? command.records ?? [];
  const quantity = Number(command.payload?.quantity ?? 0);
  const hasRecords = Array.isArray(records) && records.length > 0;
  if (!hasRecords && (!Number.isInteger(quantity) || quantity < 1)) {
    command.status = "BLOCKED";
    command.blocker = "NO_RECORDS";
    command.updated_at = asIso(now);
    event(state, "COMMAND_BLOCKED", now, { command_id: command.command_id, reason: "NO_RECORDS" });
    return;
  }
  command.status = "IN_PROGRESS";
  command.updated_at = asIso(now);
  const chunks = hasRecords
    ? splitIntoBatches(records, state.config.batchSize).map(items => ({ records: items, requestedCount: items.length }))
    : Array.from({ length: Math.ceil(quantity / state.config.batchSize) }, (_, index) => ({
      records: [],
      requestedCount: Math.min(state.config.batchSize, quantity - index * state.config.batchSize)
    }));
  for (const [index, chunk] of chunks.entries()) {
    const batch = {
      batch_id: `${command.command_id}-B${String(index + 1).padStart(3, "0")}`,
      command_id: command.command_id,
      campaign_id: command.payload?.campaignId ?? command.campaign_id ?? "unspecified",
      status: "NUEVO",
      records: chunk.records,
      requested_count: chunk.requestedCount,
      criteria: hasRecords ? null : clone(command.payload),
      created_at: asIso(now),
      updated_at: asIso(now)
    };
    state.batches.push(batch);
    createJob(state, batch, "RESEARCH", now);
  }
  event(state, "COMMAND_PLANNED", now, { command_id: command.command_id });
}

function leaseActive(lease, now) {
  return lease && new Date(lease.expires_at).getTime() > now;
}

export class PipelinePlanner {
  constructor({ store, owner = "heartbeat-dispatcher", clock = () => Date.now(), leaseMs = 15 * 60_000 }) {
    if (!store) throw new Error("store is required");
    this.store = store;
    this.owner = owner;
    this.clock = clock;
    this.leaseMs = leaseMs;
  }

  async recover() {
    const now = this.clock();
    return this.store.transact(state => {
      for (const [resource, lease] of Object.entries(state.leases)) {
        if (leaseActive(lease, now)) continue;
        delete state.leases[resource];
        const job = state.jobs.find(item => `job:${item.job_id}` === resource);
        if (job && job.status === "IN_PROGRESS") {
          job.status = "READY";
          job.updated_at = asIso(now);
          job.last_error = "LEASE_EXPIRED_RECOVERED";
          event(state, "LEASE_RECOVERED", now, { job_id: job.job_id, batch_id: job.batch_id });
        }
      }
      return state;
    });
  }

  async ingest() {
    const now = this.clock();
    return this.store.transact(state => {
      for (const command of state.commands.filter(item => item.status === "NEW")) {
        if (applyControl(state, command, now)) continue;
        if (state.config.panicStop || !state.config.enabled) continue;
        if (!state.batches.some(batch => batch.command_id === command.command_id)) seedResearch(state, command, now);
      }
      return state;
    });
  }

  async plan() {
    await this.recover();
    await this.ingest();
    const now = this.clock();
    let manifest = [];
    let configuredMax = 3;
    await this.store.transact(state => {
      configuredMax = state.config.maxSpecialists;
      if (!state.config.enabled || state.config.panicStop) return state;
      const activeCount = state.jobs.filter(job => job.status === "IN_PROGRESS" && leaseActive(state.leases[`job:${job.job_id}`], now)).length;
      const available = Math.max(0, state.config.maxSpecialists - activeCount);
      if (available === 0) return state;
      const auto = { RESEARCH: state.config.autoResearch, COPY: state.config.autoCopy, QA: state.config.autoQa };
      for (const job of state.jobs.filter(item => item.status === "READY")) {
        if (manifest.length >= available) break;
        if (!auto[job.lane]) continue;
        const resource = `job:${job.job_id}`;
        if (leaseActive(state.leases[resource], now)) continue;
        const token = makeId("LEASE");
        state.leases[resource] = { owner: this.owner, token, acquired_at: asIso(now), expires_at: asIso(now + this.leaseMs) };
        job.status = "IN_PROGRESS";
        job.attempts += 1;
        job.updated_at = asIso(now);
        const batch = state.batches.find(item => item.batch_id === job.batch_id);
        if (job.lane === "RESEARCH") batch.status = "RESEARCH_EN_CURSO";
        if (job.lane === "QA") batch.status = "QA";
        batch.updated_at = asIso(now);
        const item = {
          schemaVersion: 1,
          jobId: job.job_id,
          batchId: job.batch_id,
          commandId: job.command_id,
          lane: job.lane,
          agent: job.agent,
          leaseToken: token,
          leaseExpiresAt: state.leases[resource].expires_at,
          dryRun: state.config.dryRun,
          requestedCount: batch.requested_count ?? batch.records.length,
          criteria: clone(batch.criteria),
          records: clone(batch.records),
          completionContract: { ok: "boolean", records: "array", evidence: "array", tests: "array" }
        };
        manifest.push(item);
        event(state, "JOB_LEASED", now, { job_id: job.job_id, batch_id: job.batch_id, lane: job.lane });
      }
      return state;
    });
    return { generatedAt: asIso(now), owner: this.owner, maxSpecialists: configuredMax, jobs: manifest };
  }

  async complete(results) {
    const now = this.clock();
    return this.store.transact(state => {
      for (const result of results) {
        const job = state.jobs.find(item => item.job_id === result.jobId);
        const resource = `job:${result.jobId}`;
        const lease = state.leases[resource];
        if (!job || job.status !== "IN_PROGRESS" || !lease || lease.token !== result.leaseToken) {
          event(state, "STALE_COMPLETION_REJECTED", now, { job_id: result.jobId });
          continue;
        }
        const batch = state.batches.find(item => item.batch_id === job.batch_id);
        delete state.leases[resource];
        job.updated_at = asIso(now);
        if (!result.ok) {
          job.status = "BLOCKED";
          job.last_error = result.reason ?? "SPECIALIST_FAILED";
          batch.status = "BLOQUEADO";
          batch.blocker = job.last_error;
          batch.updated_at = asIso(now);
          event(state, "JOB_BLOCKED", now, { job_id: job.job_id, reason: job.last_error });
          continue;
        }
        if (job.lane === "RESEARCH" && (!Array.isArray(result.records) || result.records.length !== batch.requested_count)) {
          job.status = "BLOCKED";
          job.last_error = `RESEARCH_COUNT_MISMATCH:${Array.isArray(result.records) ? result.records.length : 0}/${batch.requested_count}`;
          batch.status = "BLOQUEADO";
          batch.blocker = job.last_error;
          batch.updated_at = asIso(now);
          event(state, "JOB_BLOCKED", now, { job_id: job.job_id, reason: job.last_error });
          continue;
        }
        job.status = "DONE";
        job.evidence = Array.isArray(result.evidence) ? result.evidence : [];
        job.tests = Array.isArray(result.tests) ? result.tests : [];
        if (Array.isArray(result.records)) batch.records = result.records;
        batch.status = JOB_TO_STAGE[job.lane].success;
        batch.updated_at = asIso(now);
        event(state, "JOB_COMPLETED", now, { job_id: job.job_id, batch_id: batch.batch_id, lane: job.lane });
        if (job.lane === "RESEARCH") createJob(state, batch, "COPY", now);
        if (job.lane === "COPY") createJob(state, batch, "QA", now);
        if (job.lane === "QA") {
          const command = state.commands.find(item => item.command_id === batch.command_id);
          const siblings = state.batches.filter(item => item.command_id === batch.command_id);
          if (command && siblings.every(item => ["ESPERANDO_APROBACION", "DESCARTADO"].includes(item.status))) {
            command.status = "WAITING_APPROVAL";
            command.updated_at = asIso(now);
          }
        }
      }
      return state;
    });
  }

  async planApprovedOutreach({ contexts = {} } = {}) {
    const state = await this.store.read();
    const approvals = new Map(state.approvals.filter(item => item.decision === "APPROVED").map(item => [item.approval_id, item]));
    const seen = createIdempotencyIndex({ queueRows: state.outreachQueue, providerKeys: contexts.providerKeys ?? [] });
    const planned = [];
    const blocked = [];
    for (const batch of state.batches.filter(item => item.status === "APROBADO")) {
      for (const channel of ["EMAIL", "WHATSAPP"]) {
        for (const candidate of (batch.outreach ?? []).filter(item => item.channel === channel)) {
          const context = {
            queueSnapshotLoaded: true,
            providerSnapshotLoaded: contexts.providerSnapshotLoaded === true,
            ...(contexts.byMessage?.[candidate.message_id] ?? {})
          };
          const outcome = enqueueCandidate(candidate, approvals.get(candidate.approval_id), context, seen);
          if (outcome.queued) planned.push(outcome.message);
          else blocked.push({ message_id: candidate.message_id, channel, reason: outcome.reason });
        }
      }
    }
    return { dryRun: state.config.dryRun, planned, blocked, providerCalls: 0 };
  }
}

export function summarizePipeline(state) {
  const tally = (items, key) => Object.fromEntries([...new Set(items.map(item => item[key]))].sort().map(value => [value, items.filter(item => item[key] === value).length]));
  return {
    config: state.config,
    commands: tally(state.commands, "status"),
    batches: tally(state.batches, "status"),
    jobs: tally(state.jobs, "status"),
    activeLeases: Object.keys(state.leases).length,
    queuedMessages: state.outreachQueue.length
  };
}
