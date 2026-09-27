import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  DEFAULT_CONFIG,
  PersistentWhatsappLedger,
  assertWisConnectionIdentity,
  buildIdempotencyKey,
  isOptOutText
} from "./channel.mjs";

const NOW = "2026-09-27T14:00:00.000Z";
const candidate = {
  connection_id: "wis-5679",
  owner: "WIS",
  channel: "WHATSAPP",
  prospect_key: "dist-001",
  campaign_id: "dist-ar-2026-01",
  batch_id: "DIST-AR-B001",
  approval_id: "APR-WA-001",
  message_version: "A-v1",
  sequence: 1,
  recipient: "+5491100000000",
  body: "Mensaje aprobado",
  status: "APROBADO",
  author: "copy-agent",
  qa: { status: "PASSED", reviewer: "qa-ops" },
  opt_in: { verified: true, source: "inbound_cta", scope: "WIS commercial follow-up", recorded_at: "2026-09-27T13:00:00.000Z" }
};
const approval = {
  approval_id: "APR-WA-001",
  campaign_id: "dist-ar-2026-01",
  batch_id: "DIST-AR-B001",
  channels: ["WHATSAPP"],
  message_versions: ["A-v1"],
  sequences: [1],
  recipient_limit: 2,
  expires_at: "2026-09-28T14:00:00.000Z",
  decision: "APPROVED"
};
const context = {
  email_initial_sent: true,
  email_channel_active: false,
  connection_identity: { connection_id: "wis-5679", owner: "WIS", phone_e164: "+5491111115679" }
};

async function fixture(config = DEFAULT_CONFIG) {
  const directory = await mkdtemp(resolve(tmpdir(), "wis-wa-ledger-"));
  return {
    directory,
    ledger: new PersistentWhatsappLedger({ statePath: resolve(directory, "ledger.json"), config, clock: () => new Date(NOW) })
  };
}

test("binds only the WIS 5679 connection and rejects DUGAS/QH", () => {
  assert.equal(assertWisConnectionIdentity({ connection_id: "wis-5679", owner: "WIS", phone_e164: "+5491111115679" }), true);
  assert.throws(() => assertWisConnectionIdentity({ connection_id: "dugas-5679", owner: "WIS", phone_e164: "+5491111115679" }), /FOREIGN_CONNECTION_BLOCKED|FORBIDDEN_NAMESPACE/);
  assert.throws(() => assertWisConnectionIdentity({ connection_id: "wis-5679", owner: "QH", phone_e164: "+5491111115679" }), /FOREIGN_CONNECTION_BLOCKED|FORBIDDEN_NAMESPACE/);
  assert.throws(() => assertWisConnectionIdentity({ connection_id: "wis-5679", owner: "WIS", phone_e164: "+5491111110000" }), /ACCOUNT_IDENTITY_MISMATCH/);
});

test("persists the commercial idempotency key and replays without a second row", async () => {
  const { directory, ledger } = await fixture();
  try {
    const first = await ledger.enqueue(candidate, approval, context);
    const replay = await ledger.enqueue(candidate, approval, context);
    assert.equal(first.replay, false);
    assert.equal(replay.replay, true);
    assert.equal(replay.record.id, first.record.id);
    assert.equal(first.record.idempotency_key, buildIdempotencyKey(candidate));
    assert.equal(first.record.status, "EN_COLA_DESACTIVADA");
    assert.equal(Object.keys((await ledger.snapshot()).records).length, 1);
    assert.match(await readFile(resolve(directory, "ledger.json"), "utf8"), /QUEUE_ACCEPTED_DISABLED/);
    await assert.rejects(ledger.enqueue({ ...candidate, body: "Cambio peligroso" }, approval, context), /IDEMPOTENCY_CONFLICT/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("requires opt-in, independent QA, email-first and a live 24h service window", async () => {
  for (const [change, expected] of [
    [{ opt_in: null }, "VERIFIED_OPT_IN_REQUIRED"],
    [{ qa: { status: "PASSED", reviewer: "copy-agent" } }, "INDEPENDENT_QA_REQUIRED"],
    [{ opt_in: { ...candidate.opt_in, recorded_at: "2026-09-25T13:00:00.000Z" } }, "SERVICE_WINDOW_EXPIRED"]
  ]) {
    const { directory, ledger } = await fixture();
    try { await assert.rejects(ledger.enqueue({ ...candidate, ...change }, approval, context), new RegExp(expected)); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
  const { directory, ledger } = await fixture();
  try {
    await assert.rejects(ledger.enqueue(candidate, approval, { ...context, email_initial_sent: false }), /EMAIL_FIRST_REQUIRED/);
    await assert.rejects(ledger.enqueue(candidate, approval, {
      ...context,
      connection_identity: { connection_id: "wis-5679", owner: "WIS", phone_e164: "+5491111110000" }
    }), /ACCOUNT_IDENTITY_MISMATCH/);
  }
  finally { await rm(directory, { recursive: true, force: true }); }
});

test("records opt-out durably and blocks future queueing", async () => {
  const { directory, ledger } = await fixture();
  try {
    assert.equal(isOptOutText("No me escribas más"), true);
    assert.equal((await ledger.recordInbound({ recipient: candidate.recipient, text: "baja por favor" })).opted_out, true);
    await assert.rejects(ledger.enqueue(candidate, approval, context), /CONTACT_OPTED_OUT/);
    const state = await ledger.snapshot();
    assert.ok(state.opt_outs[candidate.recipient]);
    assert.equal(JSON.stringify(state).includes("baja por favor"), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("OUTCOME_UNKNOWN cannot be retried until a durable evidenced reconciliation", async () => {
  const { directory, ledger } = await fixture();
  try {
    const queued = await ledger.enqueue(candidate, approval, context);
    await ledger.markOutcomeUnknown(queued.record.idempotency_key, { reason: "socket_timeout" });
    assert.equal((await ledger.enqueue(candidate, approval, context)).record.status, "OUTCOME_UNKNOWN");
    await assert.rejects(ledger.reconcileOutcome(queued.record.idempotency_key, { result: "NOT_SENT" }), /RECONCILIATION_EVIDENCE_REQUIRED/);
    const reconciled = await ledger.reconcileOutcome(queued.record.idempotency_key, { result: "NOT_SENT", evidence: "operator checked device and provider log", source: "manual_provider_reconciliation" });
    assert.equal(reconciled.status, "RECONCILED_NOT_SENT");
    const state = await ledger.snapshot();
    assert.equal(state.events.at(-1).type, "RECONCILED");
    assert.ok(state.events.at(-1).evidence_sha256);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("versioned channel is disabled and contains no transport send path", async () => {
  const { directory, ledger } = await fixture();
  try {
    const queued = await ledger.enqueue(candidate, approval, context);
    await assert.rejects(ledger.recordSendConfirmed(queued.record.idempotency_key, { provider_message_id: "provider-id" }), /CHANNEL_DISABLED/);
    assert.equal((await ledger.snapshot()).events.some(event => event.type === "SEND_CONFIRMED"), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("enforces ten per Buenos Aires day, fifteen-minute cadence and one follow-up", async () => {
  for (const [events, change, expected] of [
    [Array.from({ length: 10 }, (_, index) => ({ id: String(index), type: "SEND_CONFIRMED", at: `2026-09-27T${String(index + 3).padStart(2, "0")}:00:00.000Z` })), {}, "DAILY_LIMIT_REACHED"],
    [[{ id: "recent", type: "SEND_CONFIRMED", at: "2026-09-27T13:50:01.000Z" }], {}, "MINIMUM_INTERVAL_NOT_REACHED"],
    [[], { sequence: 3 }, "FOLLOWUP_LIMIT_EXCEEDED"]
  ]) {
    const { directory, ledger } = await fixture();
    try {
      await writeFile(resolve(directory, "ledger.json"), JSON.stringify({
        schema_version: 1,
        channel_id: DEFAULT_CONFIG.channel_id,
        records: {},
        opt_outs: {},
        events
      }));
      await assert.rejects(ledger.enqueue({ ...candidate, ...change }, approval, context), new RegExp(expected));
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});
