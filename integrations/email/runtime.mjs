import { createHash } from "node:crypto";
import { buildIdempotencyKey, evaluateCandidate } from "../../scripts/outreach-engine.mjs";

export const EXPECTED_SENDER = Object.freeze({
  name: "Ortu - WIS",
  email: "ortu@wis-agency.com",
  reply_to: "ortu@wis-agency.com"
});

export function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function validateConfig(config) {
  const errors = [];
  if (config?.version !== 1) errors.push("CONFIG_VERSION_INVALID");
  if (!config || !["disabled", "canary", "production"].includes(config.deployment_mode)) errors.push("DEPLOYMENT_MODE_INVALID");
  if (config?.sender?.name !== EXPECTED_SENDER.name || config?.sender?.email !== EXPECTED_SENDER.email) errors.push("FROM_INVALID");
  if (config?.sender?.reply_to !== EXPECTED_SENDER.reply_to) errors.push("REPLY_TO_INVALID");
  if (config?.limits?.daily_cap !== 25) errors.push("DAILY_CAP_INVALID");
  if (config?.limits?.interval_minutes !== 15) errors.push("INTERVAL_INVALID");
  if (config?.limits?.timezone !== "America/Buenos_Aires" || config?.limits?.window_start !== "09:30" || config?.limits?.window_end !== "17:30") errors.push("WINDOW_INVALID");
  if (JSON.stringify(config?.limits?.followup_days) !== "[3,7]" || config?.limits?.max_followups !== 2) errors.push("FOLLOWUP_POLICY_INVALID");
  if (config?.signature?.forbid_gravatar !== true) errors.push("GRAVATAR_MUST_BE_FORBIDDEN");
  if (config?.deployment_mode === "disabled" && (config.enabled !== false || config.dry_run !== true)) errors.push("DISABLED_MODE_INVARIANT_VIOLATION");
  if (!Array.isArray(config?.required_snapshots) || !config.required_snapshots.includes("Outreach_Queue") || !config.required_snapshots.includes("provider_reconciliation")) errors.push("DURABLE_SNAPSHOTS_NOT_REQUIRED");
  return { valid: errors.length === 0, errors };
}

export function preflightEmail({ config, candidate, approval, context = {}, approvedBodyHtml, signatureHtml }) {
  const configResult = validateConfig(config);
  if (!configResult.valid) return { eligible: false, reason: configResult.errors[0], errors: configResult.errors };
  if (!config.enabled || config.dry_run || config.deployment_mode === "disabled") return { eligible: false, reason: "SENDER_DISABLED" };
  if (config.sender.alias_verification !== "VERIFIED") return { eligible: false, reason: "ALIAS_NOT_VERIFIED" };
  if (config.signature.approval_status !== "APPROVED" || !config.signature.sha256) return { eligible: false, reason: "SIGNATURE_NOT_APPROVED" };
  if (!candidate?.email_verified || candidate?.recipient_type !== "CORPORATE") return { eligible: false, reason: "CORPORATE_EMAIL_VERIFICATION_REQUIRED" };
  if (candidate?.cc || candidate?.bcc) return { eligible: false, reason: "CC_BCC_FORBIDDEN" };
  if (!context.queueSnapshotLoaded || !context.providerSnapshotLoaded) return { eligible: false, reason: "DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED" };
  const key = buildIdempotencyKey(candidate);
  if (context.existingIdempotencyKeys?.has(key)) return { eligible: false, reason: "DUPLICATE_IDEMPOTENCY_KEY" };
  if (typeof approvedBodyHtml !== "string" || !approvedBodyHtml.trim()) return { eligible: false, reason: "APPROVED_BODY_REQUIRED" };
  if (!candidate.approved_subject || !candidate.approved_subject_sha256 || sha256(candidate.approved_subject) !== candidate.approved_subject_sha256) return { eligible: false, reason: "APPROVED_SUBJECT_HASH_MISMATCH" };
  if (!candidate.approved_body_sha256 || sha256(approvedBodyHtml) !== candidate.approved_body_sha256) return { eligible: false, reason: "APPROVED_BODY_HASH_MISMATCH" };
  if (typeof signatureHtml !== "string" || sha256(signatureHtml) !== config.signature.sha256) return { eligible: false, reason: "SIGNATURE_HASH_MISMATCH" };
  if (/gravatar(?:\.com)?/i.test(signatureHtml)) return { eligible: false, reason: "GRAVATAR_FORBIDDEN" };
  const eligibility = evaluateCandidate(candidate, approval, context);
  if (!eligibility.eligible) return eligibility;
  return { eligible: true, reason: "ELIGIBLE", idempotency_key: key };
}

export function buildIndividualEnvelope(input) {
  const result = preflightEmail(input);
  if (!result.eligible) return { built: false, ...result };
  return {
    built: true,
    idempotency_key: result.idempotency_key,
    envelope: {
      from: `${input.config.sender.name} <${input.config.sender.email}>`,
      replyTo: input.config.sender.reply_to,
      to: [input.candidate.recipient],
      cc: [],
      bcc: [],
      subject: input.candidate.approved_subject,
      html: `${input.approvedBodyHtml}${input.signatureHtml}`,
      headers: { "X-WIS-Idempotency-Key": result.idempotency_key }
    }
  };
}
