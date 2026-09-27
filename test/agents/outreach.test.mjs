import test from "node:test";
import assert from "node:assert/strict";
import { buildIdempotencyKey, createIdempotencyIndex, enqueueCandidate, evaluateCandidate, shouldPauseChannel } from "../../scripts/outreach-engine.mjs";

const baseApproval = {
  approval_id: "APR-1",
  campaign_id: "dist-ar",
  batch_id: "b-1",
  channels: ["EMAIL"],
  message_versions: ["A-v1"],
  sequences: [1],
  recipient_limit: 5,
  expires_at: "2026-10-01T00:00:00Z",
  decision: "APPROVED"
};
const email = {
  message_id: "MSG-1",
  prospect_key: "P 1",
  campaign_id: "dist-ar",
  batch_id: "b-1",
  channel: "EMAIL",
  sequence: 1,
  recipient: "ventas@example.com",
  message_version: "A-v1",
  approval_id: "APR-1",
  status: "APROBADO"
};

test("idempotency key is canonical and duplicate-safe", () => {
  assert.equal(buildIdempotencyKey(email), "p-1|dist-ar|EMAIL|1");
  const keys = createIdempotencyIndex({ queueRows: [], providerKeys: [] });
  const context = { now: "2026-09-27T14:00:00Z", queueSnapshotLoaded: true, providerSnapshotLoaded: true };
  assert.equal(enqueueCandidate(email, baseApproval, context, keys).queued, true);
  assert.equal(enqueueCandidate(email, baseApproval, context, keys).reason, "DUPLICATE_IDEMPOTENCY_KEY");
  assert.equal(enqueueCandidate({ ...email, prospect_key: "p-2" }, baseApproval, { now: "2026-09-27T14:00:00Z" }, keys).reason, "DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED");
  const restartIndex = createIdempotencyIndex({ queueRows: [{ idempotency_key: "p-1|dist-ar|EMAIL|1" }] });
  assert.equal(enqueueCandidate(email, baseApproval, context, restartIndex).reason, "DUPLICATE_IDEMPOTENCY_KEY");
});

test("batch approval must be exact and current", () => {
  assert.equal(evaluateCandidate(email, { ...baseApproval, decision: "PENDING" }, { now: "2026-09-27T14:00:00Z" }).reason, "BATCH_APPROVAL_REQUIRED");
  assert.equal(evaluateCandidate(email, { ...baseApproval, batch_id: "other" }, { now: "2026-09-27T14:00:00Z" }).reason, "APPROVAL_SCOPE_MISMATCH");
  assert.equal(evaluateCandidate(email, { ...baseApproval, expires_at: "2026-09-01T00:00:00Z" }, { now: "2026-09-27T14:00:00Z" }).reason, "BATCH_APPROVAL_EXPIRED");
  assert.equal(evaluateCandidate({ ...email, approval_id: "other" }, baseApproval, { now: "2026-09-27T14:00:00Z" }).reason, "APPROVAL_ID_MISMATCH");
  assert.equal(evaluateCandidate({ ...email, status: "ESPERANDO_APROBACION" }, baseApproval, { now: "2026-09-27T14:00:00Z" }).reason, "MESSAGE_STATUS_NOT_APPROVED");
});

test("WhatsApp requires email-first and verified opt-in", () => {
  const approval = { ...baseApproval, channels: ["WHATSAPP"] };
  const wa = { ...email, channel: "WHATSAPP", recipient: "+5491100000000" };
  assert.equal(evaluateCandidate(wa, approval, { now: "2026-09-27T14:00:00Z" }).reason, "EMAIL_FIRST_REQUIRED");
  assert.equal(evaluateCandidate(wa, approval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true }).reason, "VERIFIED_OPT_IN_REQUIRED");
  const optedIn = { ...wa, opt_in: { verified: true, source: "prospect initiated", recorded_at: "2026-09-27T00:00:00Z", within_24h: false, approved_template: false, template_id: null } };
  assert.equal(evaluateCandidate(optedIn, approval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true }).eligible, true);
  const expiredOptIn = { ...optedIn, opt_in: { ...optedIn.opt_in, recorded_at: "2026-09-25T00:00:00Z" } };
  assert.equal(evaluateCandidate(expiredOptIn, approval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true }).reason, "APPROVED_TEMPLATE_REQUIRED");
  const templated = { ...expiredOptIn, opt_in: { ...expiredOptIn.opt_in, approved_template: true, template_id: "wis_followup_v1" } };
  assert.equal(evaluateCandidate(templated, approval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true }).reason, "TEMPLATE_APPROVAL_RECONCILIATION_REQUIRED");
  assert.equal(evaluateCandidate(templated, approval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true, templateSnapshotLoaded: true, approvedTemplateIds: ["wis_followup_v1"] }).eligible, true);
});

test("simultaneous channels and uncertain retries are blocked", () => {
  const approval = { ...baseApproval, channels: ["WHATSAPP"] };
  const wa = { ...email, channel: "WHATSAPP", recipient: "+5491100000000", opt_in: { verified: true, source: "prospect initiated", recorded_at: "2026-09-27T00:00:00Z", within_24h: true, approved_template: false, template_id: null } };
  const context = { now: "2026-09-27T14:00:00Z", emailInitialSent: true, activeMessages: [{ ...email, status: "EN_COLA" }] };
  assert.equal(evaluateCandidate(wa, approval, context).reason, "SIMULTANEOUS_CHANNEL_BLOCKED");
  assert.equal(evaluateCandidate({ ...email, status: "OUTCOME_UNKNOWN" }, baseApproval, { now: "2026-09-27T14:00:00Z" }).reason, "OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION");
});

test("caps, cadence, windows, follow-ups and stop states are enforced", () => {
  assert.equal(evaluateCandidate(email, baseApproval, { now: "2026-09-27T14:00:00Z", todaySentCount: 25 }).reason, "DAILY_CAP_REACHED");
  assert.equal(evaluateCandidate(email, baseApproval, { now: "2026-09-27T14:00:00Z", lastSentAt: "2026-09-27T13:50:00Z" }).reason, "MINIMUM_INTERVAL_NOT_REACHED");
  assert.equal(evaluateCandidate(email, baseApproval, { now: "2026-09-27T01:00:00Z" }).reason, "OUTSIDE_EMAIL_WINDOW");
  assert.equal(evaluateCandidate(email, baseApproval, { now: "2026-09-27T14:00:00Z", prospectState: "RESPONDIDO" }).reason, "PROSPECT_SEQUENCE_STOPPED");
  const waApproval = { ...baseApproval, channels: ["WHATSAPP"], sequences: [3] };
  const wa = { ...email, channel: "WHATSAPP", sequence: 3, recipient: "+5491100000000", opt_in: { verified: true, source: "prospect initiated", recorded_at: "2026-09-27T13:00:00Z", within_24h: true, approved_template: false, template_id: null } };
  assert.equal(evaluateCandidate(wa, waApproval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true }).reason, "FOLLOWUP_LIMIT_EXCEEDED");
  const followupApproval = { ...baseApproval, sequences: [2], expires_at: "2026-10-10T00:00:00Z" };
  const followup = { ...email, sequence: 2 };
  assert.equal(evaluateCandidate(followup, followupApproval, { now: "2026-09-29T14:00:00Z", initialSentAt: "2026-09-27T14:00:00Z" }).reason, "FOLLOWUP_NOT_DUE");
  assert.equal(evaluateCandidate(followup, followupApproval, { now: "2026-09-30T14:00:00Z", initialSentAt: "2026-09-27T14:00:00Z" }).eligible, true);
  assert.equal(evaluateCandidate(email, baseApproval, { now: "2026-09-27T14:00:00Z", channelHealth: { paused: true, reason: "AUTHENTICATION_ERROR" } }).reason, "AUTHENTICATION_ERROR");
  assert.equal(evaluateCandidate(email, baseApproval, { now: "2026-09-27T14:00:00Z", previousOutcomeUnknown: true }).reason, "DURABLE_RECONCILIATION_REQUIRED");
  const reconciliationEvent = { message_id: "MSG-1", event_type: "RECONCILED", reconciled: true, evidence: ["Provider confirmed not sent"] };
  assert.equal(evaluateCandidate(email, baseApproval, { now: "2026-09-27T14:00:00Z", previousOutcomeUnknown: true, reconciliationEvent }).eligible, true);
});

test("authentication, spam and hard bounce above two percent pause the channel", () => {
  assert.equal(shouldPauseChannel({ authenticationError: true }).paused, true);
  assert.equal(shouldPauseChannel({ spamComplaint: true }).paused, true);
  assert.equal(shouldPauseChannel({ attempted: 50, hardBounces: 1 }).paused, false);
  assert.equal(shouldPauseChannel({ attempted: 25, hardBounces: 1 }).paused, true);
});
