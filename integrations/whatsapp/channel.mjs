import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const STOP_STATES = new Set(["RESPONDIDO", "CERRADO", "REBOTADO", "OPTOUT", "OUTCOME_UNKNOWN"]);
const OPTOUT = /^(?:no|baja|stop|cancelar|cancelame|no me (?:contactes|escribas|mandes)|no quiero)(?:\b|[.!\s])/iu;
const RESULTS = new Set(["NOT_SENT", "SENT", "DELIVERED", "READ"]);

export const DEFAULT_CONFIG = Object.freeze({
  schema_version: 1,
  channel_id: "wis-whatsapp-5679",
  connection_id: "wis-5679",
  owner: "WIS",
  transport: "unofficial-baileys-local",
  official_api: false,
  enabled: false,
  account_suffix: "5679",
  daily_limit: 10,
  minimum_interval_minutes: 15,
  maximum_sequence: 2,
  service_window_hours: 24,
  forbidden_namespaces: ["DUGAS", "QH"]
});

const clone = value => structuredClone(value);
const iso = value => new Date(value).toISOString();
const normalize = value => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const businessDate = value => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date(value));

function fault(code, detail) {
  const error = new Error(code);
  error.code = code;
  if (detail) error.detail = detail;
  return error;
}

function assertDate(value, code) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw fault(code);
  return date;
}

function assertE164(value) {
  if (!/^\+[1-9]\d{7,14}$/.test(value ?? "")) throw fault("INVALID_E164");
}

function containsForbidden(value, config) {
  const normalized = String(value ?? "").toUpperCase();
  return config.forbidden_namespaces.some(item => normalized.includes(item.toUpperCase()));
}

export function buildIdempotencyKey(candidate) {
  const prospect = normalize(candidate.prospect_key);
  const campaign = normalize(candidate.campaign_id);
  const channel = String(candidate.channel ?? "").trim().toUpperCase();
  if (!prospect || !campaign || channel !== "WHATSAPP") throw fault("INVALID_IDEMPOTENCY_FIELDS");
  if (!Number.isInteger(candidate.sequence) || candidate.sequence < 1) throw fault("INVALID_SEQUENCE");
  return `${prospect}|${campaign}|${channel}|${candidate.sequence}`;
}

export function assertWisConnectionIdentity(identity, config = DEFAULT_CONFIG) {
  if (identity.connection_id !== config.connection_id || identity.owner !== config.owner) {
    throw fault("FOREIGN_CONNECTION_BLOCKED");
  }
  if (containsForbidden(identity.connection_id, config) || containsForbidden(identity.owner, config) ||
      containsForbidden(identity.namespace, config)) throw fault("FORBIDDEN_NAMESPACE");
  assertE164(identity.phone_e164);
  if (!identity.phone_e164.endsWith(config.account_suffix)) throw fault("ACCOUNT_IDENTITY_MISMATCH");
  return true;
}

export function isOptOutText(text) {
  return OPTOUT.test(String(text ?? "").trim());
}

function freshState(config) {
  return {
    schema_version: 1,
    channel_id: config.channel_id,
    records: {},
    opt_outs: {},
    events: []
  };
}

function validateState(state, config) {
  if (state?.schema_version !== 1 || state.channel_id !== config.channel_id ||
      typeof state.records !== "object" || typeof state.opt_outs !== "object" || !Array.isArray(state.events)) {
    throw fault("INVALID_LEDGER");
  }
  return state;
}

export class PersistentWhatsappLedger {
  constructor({ statePath, config = DEFAULT_CONFIG, clock = () => new Date() }) {
    if (!statePath) throw fault("STATE_PATH_REQUIRED");
    this.statePath = resolve(statePath);
    this.lockPath = `${this.statePath}.lock`;
    this.config = Object.freeze({ ...DEFAULT_CONFIG, ...config });
    this.clock = clock;
  }

  async #read() {
    try {
      return validateState(JSON.parse(await readFile(this.statePath, "utf8")), this.config);
    } catch (error) {
      if (error.code === "ENOENT") return freshState(this.config);
      throw error;
    }
  }

  async #write(state) {
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    const temp = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temp, this.statePath);
  }

  async #mutate(operation) {
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    let lock;
    try {
      lock = await open(this.lockPath, "wx", 0o600);
    } catch (error) {
      if (error.code === "EEXIST") throw fault("LEDGER_BUSY");
      throw error;
    }
    try {
      const state = await this.#read();
      const result = await operation(state);
      await this.#write(state);
      return clone(result);
    } finally {
      await lock.close();
      await rm(this.lockPath, { force: true });
    }
  }

  async snapshot() {
    return clone(await this.#read());
  }

  #event(state, type, data, at) {
    const event = { id: randomUUID(), type, at: iso(at), ...data };
    state.events.push(event);
    return event;
  }

  #validateCandidate(state, candidate, approval, context, now) {
    if (this.config.enabled !== false) throw fault("VERSIONED_CONFIG_MUST_REMAIN_DISABLED");
    assertWisConnectionIdentity(context.connection_identity ?? {}, this.config);
    if (candidate.connection_id !== this.config.connection_id || candidate.owner !== this.config.owner ||
        containsForbidden(candidate.connection_id, this.config) || containsForbidden(candidate.owner, this.config) ||
        containsForbidden(candidate.namespace, this.config)) throw fault("FOREIGN_CONNECTION_BLOCKED");
    assertE164(candidate.recipient);
    if (candidate.status !== "APROBADO") throw fault("MESSAGE_NOT_APPROVED");
    if (candidate.sequence > this.config.maximum_sequence) throw fault("FOLLOWUP_LIMIT_EXCEEDED");
    if (!candidate.qa || candidate.qa.status !== "PASSED" || !candidate.qa.reviewer ||
        normalize(candidate.qa.reviewer) === normalize(candidate.author)) throw fault("INDEPENDENT_QA_REQUIRED");
    if (!approval || approval.decision !== "APPROVED") throw fault("BATCH_APPROVAL_REQUIRED");
    if (candidate.approval_id !== approval.approval_id || candidate.batch_id !== approval.batch_id ||
        candidate.campaign_id !== approval.campaign_id || !approval.channels?.includes("WHATSAPP") ||
        !approval.message_versions?.includes(candidate.message_version) ||
        !approval.sequences?.includes(candidate.sequence)) throw fault("APPROVAL_SCOPE_MISMATCH");
    if (assertDate(approval.expires_at, "INVALID_APPROVAL_EXPIRY") <= now) throw fault("BATCH_APPROVAL_EXPIRED");
    const approvedCount = Object.values(state.records).filter(row => row.approval_id === approval.approval_id).length;
    if (!Number.isInteger(approval.recipient_limit) || approvedCount >= approval.recipient_limit) {
      throw fault("RECIPIENT_LIMIT_REACHED");
    }
    if (!context.email_initial_sent) throw fault("EMAIL_FIRST_REQUIRED");
    if (context.email_channel_active) throw fault("SIMULTANEOUS_CHANNEL_BLOCKED");
    if (STOP_STATES.has(context.prospect_state)) throw fault("PROSPECT_STOPPED");
    if (state.opt_outs[candidate.recipient]) throw fault("CONTACT_OPTED_OUT");
    const optIn = candidate.opt_in;
    if (!optIn?.verified || !optIn.source || !optIn.scope || !optIn.recorded_at) throw fault("VERIFIED_OPT_IN_REQUIRED");
    const optInAt = assertDate(optIn.recorded_at, "INVALID_OPT_IN_DATE");
    const age = now - optInAt;
    if (age < 0 || age > this.config.service_window_hours * 60 * 60 * 1000) {
      // This unofficial transport cannot use official WhatsApp templates. The safe
      // behavior outside the customer-service window is to block, not emulate one.
      throw fault("SERVICE_WINDOW_EXPIRED");
    }
    const sentToday = state.events.filter(event => event.type === "SEND_CONFIRMED" &&
      businessDate(event.at) === businessDate(now)).length;
    if (sentToday >= this.config.daily_limit) throw fault("DAILY_LIMIT_REACHED");
    const last = [...state.events].reverse().find(event => event.type === "SEND_CONFIRMED");
    if (last && now - new Date(last.at) < this.config.minimum_interval_minutes * 60 * 1000) {
      throw fault("MINIMUM_INTERVAL_NOT_REACHED");
    }
  }

  async enqueue(candidate, approval, context = {}) {
    return this.#mutate(state => {
      const key = buildIdempotencyKey(candidate);
      const fingerprint = sha256(JSON.stringify({
        recipient: candidate.recipient,
        body: candidate.body,
        message_version: candidate.message_version,
        approval_id: candidate.approval_id
      }));
      const previous = state.records[key];
      if (previous) {
        if (previous.request_fingerprint !== fingerprint) throw fault("IDEMPOTENCY_CONFLICT");
        return { replay: true, record: previous };
      }
      const now = this.clock();
      this.#validateCandidate(state, candidate, approval, context, now);
      const record = {
        id: randomUUID(),
        idempotency_key: key,
        request_fingerprint: fingerprint,
        connection_id: this.config.connection_id,
        owner: this.config.owner,
        prospect_key: candidate.prospect_key,
        campaign_id: candidate.campaign_id,
        batch_id: candidate.batch_id,
        approval_id: candidate.approval_id,
        message_version: candidate.message_version,
        sequence: candidate.sequence,
        recipient: candidate.recipient,
        body: candidate.body,
        status: "EN_COLA_DESACTIVADA",
        created_at: iso(now),
        updated_at: iso(now)
      };
      state.records[key] = record;
      this.#event(state, "QUEUE_ACCEPTED_DISABLED", { idempotency_key: key, record_id: record.id }, now);
      return { replay: false, record };
    });
  }

  async recordOptOut({ recipient, source = "inbound", evidence, at = this.clock() }) {
    assertE164(recipient);
    if (!evidence || typeof evidence !== "string") throw fault("OPTOUT_EVIDENCE_REQUIRED");
    return this.#mutate(state => {
      const existing = state.opt_outs[recipient];
      if (existing) return existing;
      const optOut = { recipient, source, evidence_sha256: sha256(evidence), at: iso(at) };
      state.opt_outs[recipient] = optOut;
      for (const record of Object.values(state.records)) {
        if (record.recipient === recipient && !["ENVIADO", "ENTREGADO", "LEIDO"].includes(record.status)) {
          record.status = "OPTOUT";
          record.updated_at = iso(at);
        }
      }
      this.#event(state, "OPTOUT_RECORDED", { recipient, source }, at);
      return optOut;
    });
  }

  async recordInbound({ recipient, text, at = this.clock() }) {
    if (!isOptOutText(text)) return { opted_out: false };
    const record = await this.recordOptOut({ recipient, source: "inbound_text", evidence: text, at });
    return { opted_out: true, record };
  }

  async markOutcomeUnknown(idempotencyKey, { reason, at = this.clock() }) {
    if (!reason) throw fault("UNKNOWN_OUTCOME_REASON_REQUIRED");
    return this.#mutate(state => {
      const record = state.records[idempotencyKey];
      if (!record) throw fault("RECORD_NOT_FOUND");
      record.status = "OUTCOME_UNKNOWN";
      record.updated_at = iso(at);
      this.#event(state, "OUTCOME_UNKNOWN", { idempotency_key: idempotencyKey, reason }, at);
      return record;
    });
  }

  async reconcileOutcome(idempotencyKey, { result, evidence, source, at = this.clock() }) {
    if (!RESULTS.has(result)) throw fault("INVALID_RECONCILIATION_RESULT");
    if (!evidence || !source) throw fault("RECONCILIATION_EVIDENCE_REQUIRED");
    return this.#mutate(state => {
      const record = state.records[idempotencyKey];
      if (!record) throw fault("RECORD_NOT_FOUND");
      if (record.status !== "OUTCOME_UNKNOWN") throw fault("RECONCILIATION_NOT_ALLOWED");
      record.status = result === "NOT_SENT" ? "RECONCILED_NOT_SENT" :
        result === "SENT" ? "ENVIADO" : result === "DELIVERED" ? "ENTREGADO" : "LEIDO";
      record.updated_at = iso(at);
      this.#event(state, "RECONCILED", {
        idempotency_key: idempotencyKey,
        result,
        source,
        evidence_sha256: sha256(evidence)
      }, at);
      return record;
    });
  }

  async recordSendConfirmed(idempotencyKey, { provider_message_id, at = this.clock() }) {
    if (!provider_message_id) throw fault("PROVIDER_MESSAGE_ID_REQUIRED");
    return this.#mutate(state => {
      const record = state.records[idempotencyKey];
      if (!record) throw fault("RECORD_NOT_FOUND");
      if (!this.config.enabled) throw fault("CHANNEL_DISABLED");
      record.status = "ENVIADO";
      record.updated_at = iso(at);
      this.#event(state, "SEND_CONFIRMED", {
        idempotency_key: idempotencyKey,
        provider_message_id_sha256: sha256(provider_message_id)
      }, at);
      return record;
    });
  }
}
