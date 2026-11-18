import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const OUTREACH_EVENT_TYPES = Object.freeze([
  "PREPARED", "QUEUED", "SUBMITTED", "DELIVERED_TO_MX", "DEFERRED", "SOFT_BOUNCE", "HARD_BOUNCE",
  "OPEN_ESTIMATED", "CLICKED", "REPLIED", "POSITIVE_REPLY", "NEGATIVE_REPLY", "COMPLAINT", "UNSUBSCRIBED",
  "MEETING_BOOKED", "INBOX_PRIMARY", "INBOX_OTHER", "PROMOTIONS", "SPAM", "OUTCOME_UNKNOWN", "RECONCILED"
]);
const TYPES = new Set(OUTREACH_EVENT_TYPES);
const sha256 = value => createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
const iso = value => new Date(value).toISOString();

const emailMap = Object.freeze({
  accepted: "SUBMITTED", submitted: "SUBMITTED", opened: "OPEN_ESTIMATED", clicked: "CLICKED", replied: "REPLIED",
  hard_bounce: "HARD_BOUNCE", soft_bounce: "SOFT_BOUNCE", deferred: "DEFERRED", unsubscribed: "UNSUBSCRIBED",
  complaint: "COMPLAINT", positive_reply: "POSITIVE_REPLY", negative_reply: "NEGATIVE_REPLY", meeting_booked: "MEETING_BOOKED",
  inbox_primary: "INBOX_PRIMARY", inbox_other: "INBOX_OTHER", promotions: "PROMOTIONS", spam: "SPAM",
  outcome_unknown: "OUTCOME_UNKNOWN", reconciled: "RECONCILED"
});
const whatsappMap = Object.freeze({ sent: "SUBMITTED", submitted: "SUBMITTED", delivered: "DELIVERED_TO_MX", read: "OPEN_ESTIMATED",
  replied: "REPLIED", inbound: "REPLIED", optout: "UNSUBSCRIBED", unsubscribed: "UNSUBSCRIBED",
  failed: "OUTCOME_UNKNOWN", outcome_unknown: "OUTCOME_UNKNOWN", reconciled: "RECONCILED" });

function clean(value, max = 300) { return String(value ?? "").trim().slice(0, max); }

export function normalizeProviderEvent(provider, payload = {}, receivedAt = new Date()) {
  const normalizedProvider = clean(provider, 30).toUpperCase();
  const body = payload.data ?? payload.payload ?? payload;
  const envelopeType = clean(payload.event_type ?? payload.eventType ?? payload.type ?? payload.event, 80).toLowerCase();
  let rawType = envelopeType;
  if (normalizedProvider === "WHATSAPP" || normalizedProvider === "BAILEYS") {
    const status = clean(body.delivery_status ?? body.deliveryStatus ?? body.status ?? body.operation_status ?? body.operationStatus, 80).toLowerCase();
    const direction = clean(body.direction ?? body.message?.direction, 30).toLowerCase();
    if (["message.created", "message_created"].includes(envelopeType) && ["in", "inbound", "incoming"].includes(direction)) rawType = "inbound";
    else if (["message.updated", "message_updated", "operation.updated", "operation_updated"].includes(envelopeType)) rawType = status;
  }
  const eventType = normalizedProvider === "WIS_MAILER" || normalizedProvider === "EMAIL" ? emailMap[rawType] :
    normalizedProvider === "WHATSAPP" || normalizedProvider === "BAILEYS" ? whatsappMap[rawType] : null;
  if (!eventType || !TYPES.has(eventType)) throw Object.assign(new Error("PROVIDER_EVENT_UNSUPPORTED"), { status: 400 });
  const providerEventId = clean(payload.event_id ?? payload.eventId ?? payload.id ?? payload.message_id ?? payload.messageId, 200);
  const prospectKey = clean(body.prospect_key ?? body.prospectKey ?? body.contact_id ?? body.contactId ?? body.lead_id ?? body.leadId ?? body.lead_email ?? body.email ?? body.phone ?? body.to ?? body.from, 200);
  const campaignId = clean(body.campaign_id ?? body.campaignId, 200);
  const providerRef = clean(body.message_id ?? body.messageId ?? body.operation_id ?? body.operationId ?? body.email_id ?? body.emailId ?? body.id, 200);
  const timestamp = iso(body.timestamp ?? body.updated_at ?? body.updatedAt ?? body.created_at ?? body.createdAt ?? payload.timestamp ?? receivedAt);
  const stableSource = providerEventId || sha256(JSON.stringify({ normalizedProvider, rawType, prospectKey, campaignId, providerRef, timestamp }));
  return {
    eventId: `${normalizedProvider}:${stableSource}`,
    timestamp,
    channel: normalizedProvider === "WIS_MAILER" || normalizedProvider === "EMAIL" ? "EMAIL" : "WHATSAPP",
    eventType,
    provider: normalizedProvider,
    providerEventId: providerEventId || stableSource,
    providerRefHash: providerRef ? sha256(providerRef) : "",
    prospectKey,
    campaignId,
    sequence: Number(body.sequence ?? body.step ?? 1) || 1,
    variant: clean(body.variant ?? body.variant_id ?? body.variantId, 80),
    reason: clean(body.reason ?? body.error ?? body.error_message ?? body.errorMessage ?? (typeof body.message === "string" ? body.message : ""), 500),
    rawHash: sha256(JSON.stringify(payload))
  };
}

function freshState() { return { schemaVersion: 1, events: {}, order: [] }; }

export class PersistentOutreachEventStore {
  constructor({ statePath }) {
    if (!statePath) throw new Error("OUTREACH_EVENT_STATE_PATH_REQUIRED");
    this.statePath = resolve(statePath);
    this.lockPath = `${this.statePath}.lock`;
  }
  async #read() {
    try {
      const state = JSON.parse(await readFile(this.statePath, "utf8"));
      if (state?.schemaVersion !== 1 || typeof state.events !== "object" || !Array.isArray(state.order)) throw new Error("OUTREACH_EVENT_STATE_INVALID");
      return state;
    } catch (error) { if (error.code === "ENOENT") return freshState(); throw error; }
  }
  async #write(state) {
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, this.statePath);
  }
  async ingest(event) {
    if (!TYPES.has(event?.eventType) || !event?.eventId) throw new Error("OUTREACH_EVENT_INVALID");
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    let lock;
    try { lock = await open(this.lockPath, "wx", 0o600); }
    catch (error) { if (error.code === "EEXIST") throw Object.assign(new Error("OUTREACH_EVENT_STORE_BUSY"), { status: 409 }); throw error; }
    try {
      const state = await this.#read();
      if (state.events[event.eventId]) return { duplicate: true, event: structuredClone(state.events[event.eventId]) };
      state.events[event.eventId] = event;
      state.order.push(event.eventId);
      await this.#write(state);
      return { duplicate: false, event: structuredClone(event) };
    } finally { await lock.close(); await rm(this.lockPath, { force: true }); }
  }
  async snapshot(limit = 5000) {
    const state = await this.#read();
    return state.order.slice(-limit).map(id => structuredClone(state.events[id]));
  }
}

export function buildOutreachMetrics(events = []) {
  const counts = Object.fromEntries(OUTREACH_EVENT_TYPES.map(type => [type, 0]));
  const prospects = new Set();
  for (const event of events) {
    if (counts[event.eventType] !== undefined) counts[event.eventType] += 1;
    if (event.prospectKey) prospects.add(event.prospectKey);
  }
  const delivered = counts.DELIVERED_TO_MX;
  const submitted = counts.SUBMITTED;
  return {
    generatedAt: new Date().toISOString(),
    events: events.length,
    uniqueProspects: prospects.size,
    counts,
    rates: {
      hardBounce: submitted ? counts.HARD_BOUNCE / submitted : 0,
      complaint: delivered ? counts.COMPLAINT / delivered : 0,
      reply: delivered ? counts.REPLIED / delivered : 0,
      positiveReply: delivered ? counts.POSITIVE_REPLY / delivered : 0,
      meeting: delivered ? counts.MEETING_BOOKED / delivered : 0,
      openEstimated: delivered ? counts.OPEN_ESTIMATED / delivered : 0
    },
    pauseRequired: {
      EMAIL: counts.COMPLAINT > 0 || (submitted > 0 && counts.HARD_BOUNCE / submitted > 0.02) ||
        events.some(event => event.channel === "EMAIL" && event.eventType === "DEFERRED" && /auth|oauth|credential/i.test(event.reason || "")),
      WHATSAPP: events.some(event => event.channel === "WHATSAPP" && event.eventType === "OUTCOME_UNKNOWN")
    },
    warnings: ["OPEN_ESTIMATED no prueba lectura humana.", "La carpeta real sólo se conoce en buzones semilla/controlados."]
  };
}

export function assignExperimentVariant({ prospectKey, campaignId, variants, existingAssignment }) {
  if (existingAssignment) return { ...existingAssignment, reused: true };
  if (!prospectKey || !campaignId || !Array.isArray(variants) || variants.length < 2) throw new Error("EXPERIMENT_ASSIGNMENT_INVALID");
  const digest = sha256(`${campaignId}|${prospectKey}`);
  const variant = variants[Number.parseInt(digest.slice(0, 8), 16) % variants.length];
  return { assignmentId: `EXP-${digest.slice(0, 20)}`, prospectKey, campaignId, variant, assignedAt: new Date().toISOString(), immutable: true, reused: false };
}
