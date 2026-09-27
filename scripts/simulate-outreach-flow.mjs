import assert from "node:assert/strict";
import { createIdempotencyIndex, enqueueCandidate, evaluateCandidate, shouldPauseChannel } from "./outreach-engine.mjs";

const prospects = Array.from({ length: 25 }, (_, index) => ({
  prospect_key: `dist-${String(index + 1).padStart(3, "0")}`,
  campaign_id: "dist-ar-2026-01",
  batch_id: "DIST-AR-B001",
  source_sheet: "Distribuidoras_300",
  source_row: index + 2,
  empresa: `Fixture ${index + 1}`,
  channel: "EMAIL",
  sequence: 1,
  recipient: `fixture${index + 1}@example.invalid`,
  message_version: index % 2 ? "A-v1" : "B-v1",
  approval_id: "APR-WIS-EMAIL-001-CANARY",
  eligibility: "ELIGIBLE",
  status: "ESPERANDO_APROBACION",
  attempts: 0,
  next_action: "Esperar aprobación"
}));

const pendingApproval = {
  approval_id: "APR-WIS-EMAIL-001-CANARY",
  campaign_id: "dist-ar-2026-01",
  batch_id: "DIST-AR-B001",
  channels: ["EMAIL"],
  message_versions: ["A-v1", "B-v1"],
  sequences: [1],
  recipient_limit: 5,
  expires_at: "2026-10-04T09:00:00Z",
  decision: "PENDING"
};
assert.equal(evaluateCandidate({ ...prospects[0], status: "APROBADO" }, pendingApproval, { now: "2026-09-27T14:00:00Z" }).reason, "BATCH_APPROVAL_REQUIRED");

const approval = { ...pendingApproval, decision: "APPROVED" };
const seenKeys = createIdempotencyIndex({ queueRows: [], providerKeys: [] });
const queued = prospects.slice(0, 5).map((candidate, index) =>
  enqueueCandidate({ ...candidate, status: "APROBADO" }, approval, { now: "2026-09-27T14:00:00Z", batchQueuedCount: index, queueSnapshotLoaded: true, providerSnapshotLoaded: true }, seenKeys)
);
assert.equal(queued.filter(item => item.queued).length, 5);
assert.equal(enqueueCandidate({ ...prospects[0], status: "APROBADO" }, approval, { now: "2026-09-27T14:00:00Z", queueSnapshotLoaded: true, providerSnapshotLoaded: true }, seenKeys).reason, "DUPLICATE_IDEMPOTENCY_KEY");

const whatsapp = {
  ...prospects[5],
  prospect_key: "dist-006",
  channel: "WHATSAPP",
  recipient: "+5491100000000",
  approval_id: "APR-WIS-WA-001-CANARY",
  message_version: "A-v1",
  status: "APROBADO",
  opt_in: null
};
const whatsappApproval = {
  ...approval,
  approval_id: "APR-WIS-WA-001-CANARY",
  channels: ["WHATSAPP"],
  recipient_limit: 2
};
assert.equal(evaluateCandidate(whatsapp, whatsappApproval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true }).reason, "VERIFIED_OPT_IN_REQUIRED");
assert.equal(evaluateCandidate({ ...whatsapp, status: "OUTCOME_UNKNOWN" }, whatsappApproval, { now: "2026-09-27T14:00:00Z", emailInitialSent: true }).reason, "OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION");
assert.equal(shouldPauseChannel({ attempted: 25, hardBounces: 1 }).reason, "HARD_BOUNCE_RATE_ABOVE_2_PERCENT");
assert.equal(shouldPauseChannel({ authenticationError: true }).paused, true);
assert.equal(shouldPauseChannel({ spamComplaint: true }).paused, true);

console.log(JSON.stringify({
  mode: "DRY_RUN",
  externalProviderCalls: 0,
  fixtures: prospects.length,
  canaryEmailsQueuedInMemory: 5,
  whatsappWithoutOptIn: "BLOCKED",
  duplicate: "BLOCKED",
  outcomeUnknownRetry: "BLOCKED",
  channelPauseRules: "PASS"
}));
