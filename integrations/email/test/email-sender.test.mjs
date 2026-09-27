import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndividualEnvelope, preflightEmail, sha256, validateConfig } from "../runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await fs.readFile(path.join(root, "config.disabled.json"), "utf8"));
const workflow = JSON.parse(await fs.readFile(path.join(root, "workflows/wis-email-sender.disabled.json"), "utf8"));
const signature = "<table><tr><td>Firma aprobada</td></tr></table>";
const body = "<p>Mensaje aprobado, sin cambios.</p>";
const candidate = {
  message_id: "MSG-EMAIL-1",
  prospect_key: "dist-001",
  campaign_id: "dist-ar-2026-01",
  batch_id: "DIST-AR-B001",
  channel: "EMAIL",
  sequence: 1,
  recipient: "ventas@example.com",
  recipient_type: "CORPORATE",
  email_verified: true,
  approved_subject: "Consulta concreta",
  approved_subject_sha256: sha256("Consulta concreta"),
  approved_body_sha256: sha256(body),
  message_version: "A-v1",
  approval_id: "APR-1",
  status: "APROBADO"
};
const approval = {
  approval_id: "APR-1",
  campaign_id: candidate.campaign_id,
  batch_id: candidate.batch_id,
  channels: ["EMAIL"],
  message_versions: ["A-v1"],
  sequences: [1],
  recipient_limit: 5,
  expires_at: "2026-10-04T23:59:00Z",
  decision: "APPROVED"
};
const context = {
  now: "2026-09-28T14:00:00Z",
  queueSnapshotLoaded: true,
  providerSnapshotLoaded: true,
  existingIdempotencyKeys: new Set()
};

test("shipped configuration is valid but fail-closed", () => {
  assert.deepEqual(validateConfig(config), { valid: true, errors: [] });
  assert.equal(preflightEmail({ config, candidate, approval, context, approvedBodyHtml: body, signatureHtml: signature }).reason, "SENDER_DISABLED");
});

test("workflow export has three independent disabled guards", () => {
  const gmail = workflow.nodes.find(node => node.type === "n8n-nodes-base.gmail");
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes[0].type, "n8n-nodes-base.manualTrigger");
  assert.match(workflow.nodes.find(node => node.name === "Hard Disabled Gate").parameters.jsCode, /ENABLED = false/);
  assert.equal(gmail.disabled, true);
  assert.equal(gmail.parameters.options.senderName, "Ortu - WIS");
  assert.equal(gmail.parameters.options.replyTo, "ortu@wis-agency.com");
  assert.equal(JSON.stringify(gmail.parameters).includes("cc"), false);
  assert.equal(JSON.stringify(gmail.parameters).includes("bcc"), false);
  assert.doesNotMatch(JSON.stringify(workflow), /DUGAS|QH/i);
});

test("an approved fixture builds one immutable individual envelope", () => {
  const enabled = structuredClone(config);
  Object.assign(enabled, { enabled: true, dry_run: false, deployment_mode: "canary" });
  enabled.sender.alias_verification = "VERIFIED";
  enabled.signature = { ...enabled.signature, approval_status: "APPROVED", sha256: sha256(signature) };
  const result = buildIndividualEnvelope({ config: enabled, candidate, approval, context, approvedBodyHtml: body, signatureHtml: signature });
  assert.equal(result.built, true);
  assert.equal(result.envelope.from, "Ortu - WIS <ortu@wis-agency.com>");
  assert.deepEqual(result.envelope.to, [candidate.recipient]);
  assert.deepEqual(result.envelope.cc, []);
  assert.deepEqual(result.envelope.bcc, []);
  assert.equal(result.envelope.html, body + signature);
});

test("copy changes, duplicate keys, Gravatar, unverified aliases and CC are blocked", () => {
  const enabled = structuredClone(config);
  Object.assign(enabled, { enabled: true, dry_run: false, deployment_mode: "canary" });
  enabled.signature = { ...enabled.signature, approval_status: "APPROVED", sha256: sha256(signature) };
  enabled.sender.alias_verification = "PENDING";
  assert.equal(preflightEmail({ config: enabled, candidate, approval, context, approvedBodyHtml: body, signatureHtml: signature }).reason, "ALIAS_NOT_VERIFIED");
  enabled.sender.alias_verification = "VERIFIED";
  assert.equal(preflightEmail({ config: enabled, candidate: { ...candidate, approved_subject: "Asunto alterado" }, approval, context, approvedBodyHtml: body, signatureHtml: signature }).reason, "APPROVED_SUBJECT_HASH_MISMATCH");
  assert.equal(preflightEmail({ config: enabled, candidate, approval, context, approvedBodyHtml: `${body}cambio`, signatureHtml: signature }).reason, "APPROVED_BODY_HASH_MISMATCH");
  enabled.signature.sha256 = sha256('<img src="https://gravatar.com/avatar/x">');
  assert.equal(preflightEmail({ config: enabled, candidate, approval, context, approvedBodyHtml: body, signatureHtml: '<img src="https://gravatar.com/avatar/x">' }).reason, "GRAVATAR_FORBIDDEN");
  enabled.signature.sha256 = sha256(signature);
  assert.equal(preflightEmail({ config: enabled, candidate: { ...candidate, cc: "otro@example.com" }, approval, context, approvedBodyHtml: body, signatureHtml: signature }).reason, "CC_BCC_FORBIDDEN");
  const duplicateContext = { ...context, existingIdempotencyKeys: new Set(["dist-001|dist-ar-2026-01|EMAIL|1"]) };
  assert.equal(preflightEmail({ config: enabled, candidate, approval, context: duplicateContext, approvedBodyHtml: body, signatureHtml: signature }).reason, "DUPLICATE_IDEMPOTENCY_KEY");
});
