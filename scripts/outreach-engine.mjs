const CHANNELS = new Set(["EMAIL", "WHATSAPP"]);
const ACTIVE_CHANNEL_STATES = new Set(["APROBADO", "EN_COLA", "OUTCOME_UNKNOWN"]);
const TERMINAL_STOP_STATES = new Set(["RESPONDIDO", "CERRADO", "REBOTADO", "OPTOUT", "OUTCOME_UNKNOWN"]);
const DAILY_CAPS = { EMAIL: 25, WHATSAPP: 10 };
const MAX_SEQUENCES = { EMAIL: 3, WHATSAPP: 2 };
const MIN_INTERVAL_MS = 15 * 60 * 1000;

const normalize = value => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-");

export function buildIdempotencyKey({ prospect_key, campaign_id, channel, sequence }) {
  const normalizedChannel = String(channel ?? "").trim().toUpperCase();
  if (!normalize(prospect_key) || !normalize(campaign_id) || !CHANNELS.has(normalizedChannel)) {
    throw new Error("Idempotency fields are incomplete");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 3) {
    throw new Error("Invalid outreach sequence");
  }
  return [normalize(prospect_key), normalize(campaign_id), normalizedChannel, sequence].join("|");
}

export function createIdempotencyIndex({ queueRows = [], providerKeys = [] } = {}) {
  const keys = new Set(providerKeys);
  for (const row of queueRows) {
    if (row.idempotency_key) keys.add(row.idempotency_key);
  }
  return keys;
}

export function evaluateCandidate(candidate, approval, context = {}) {
  const now = new Date(context.now ?? Date.now());
  if (candidate.status === "OUTCOME_UNKNOWN" && !context.reconciled) {
    return { eligible: false, reason: "OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION" };
  }
  if (candidate.status !== "APROBADO") {
    return { eligible: false, reason: "MESSAGE_STATUS_NOT_APPROVED" };
  }
  if (context.channelHealth?.paused) {
    return { eligible: false, reason: context.channelHealth.reason ?? "CHANNEL_PAUSED" };
  }
  if (context.previousOutcomeUnknown) {
    const event = context.reconciliationEvent;
    if (!event || event.message_id !== candidate.message_id || event.event_type !== "RECONCILED" || event.reconciled !== true || !event.evidence?.length) {
      return { eligible: false, reason: "DURABLE_RECONCILIATION_REQUIRED" };
    }
  }
  if (TERMINAL_STOP_STATES.has(context.prospectState)) {
    return { eligible: false, reason: "PROSPECT_SEQUENCE_STOPPED" };
  }
  if (!approval || approval.decision !== "APPROVED") {
    return { eligible: false, reason: "BATCH_APPROVAL_REQUIRED" };
  }
  if (candidate.approval_id !== approval.approval_id) {
    return { eligible: false, reason: "APPROVAL_ID_MISMATCH" };
  }
  if (new Date(approval.expires_at) <= now) {
    return { eligible: false, reason: "BATCH_APPROVAL_EXPIRED" };
  }
  if (approval.batch_id !== candidate.batch_id || approval.campaign_id !== candidate.campaign_id) {
    return { eligible: false, reason: "APPROVAL_SCOPE_MISMATCH" };
  }
  if (!approval.channels.includes(candidate.channel) ||
      !approval.message_versions.includes(candidate.message_version) ||
      !approval.sequences.includes(candidate.sequence)) {
    return { eligible: false, reason: "APPROVAL_SCOPE_MISMATCH" };
  }
  if ((context.batchQueuedCount ?? 0) >= approval.recipient_limit) {
    return { eligible: false, reason: "RECIPIENT_LIMIT_REACHED" };
  }
  if (candidate.sequence > MAX_SEQUENCES[candidate.channel]) {
    return { eligible: false, reason: "FOLLOWUP_LIMIT_EXCEEDED" };
  }
  if (candidate.sequence > 1) {
    if (!context.initialSentAt) return { eligible: false, reason: "FOLLOWUP_SCHEDULE_REQUIRED" };
    if (candidate.channel === "EMAIL") {
      const dueDays = candidate.sequence === 2 ? 3 : 7;
      const dueAt = new Date(context.initialSentAt).getTime() + dueDays * 24 * 60 * 60 * 1000;
      if (now.getTime() < dueAt) return { eligible: false, reason: "FOLLOWUP_NOT_DUE" };
    }
  }
  if ((context.todaySentCount ?? 0) >= DAILY_CAPS[candidate.channel]) {
    return { eligible: false, reason: "DAILY_CAP_REACHED" };
  }
  if (context.lastSentAt && now - new Date(context.lastSentAt) < MIN_INTERVAL_MS) {
    return { eligible: false, reason: "MINIMUM_INTERVAL_NOT_REACHED" };
  }
  const conflicts = (context.activeMessages ?? []).some(message =>
    message.prospect_key === candidate.prospect_key &&
    message.campaign_id === candidate.campaign_id &&
    message.channel !== candidate.channel &&
    ACTIVE_CHANNEL_STATES.has(message.status)
  );
  if (conflicts) return { eligible: false, reason: "SIMULTANEOUS_CHANNEL_BLOCKED" };

  if (candidate.channel === "EMAIL") {
    if (!candidate.recipient || !candidate.recipient.includes("@")) {
      return { eligible: false, reason: "VERIFIABLE_EMAIL_REQUIRED" };
    }
    const timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const hour = Number(timeParts.find(part => part.type === "hour")?.value);
    const minute = Number(timeParts.find(part => part.type === "minute")?.value);
    const minutesInDay = hour * 60 + minute;
    if (minutesInDay < 570 || minutesInDay > 1050) {
      return { eligible: false, reason: "OUTSIDE_EMAIL_WINDOW" };
    }
  } else if (candidate.channel === "WHATSAPP") {
    if (!context.emailInitialSent) return { eligible: false, reason: "EMAIL_FIRST_REQUIRED" };
    const optIn = candidate.opt_in;
    if (!optIn?.verified || !optIn.source || !optIn.recorded_at) {
      return { eligible: false, reason: "VERIFIED_OPT_IN_REQUIRED" };
    }
    const optInAgeMs = now - new Date(optIn.recorded_at);
    const within24h = optInAgeMs >= 0 && optInAgeMs <= 24 * 60 * 60 * 1000;
    if (!within24h) {
      if (!optIn.approved_template || !optIn.template_id) {
        return { eligible: false, reason: "APPROVED_TEMPLATE_REQUIRED" };
      }
      if (!context.templateSnapshotLoaded || !context.approvedTemplateIds?.includes(optIn.template_id)) {
        return { eligible: false, reason: "TEMPLATE_APPROVAL_RECONCILIATION_REQUIRED" };
      }
    }
  }
  return { eligible: true, reason: "ELIGIBLE" };
}

export function enqueueCandidate(candidate, approval, context, seenKeys) {
  const idempotencyKey = buildIdempotencyKey(candidate);
  if (!context?.queueSnapshotLoaded || !context?.providerSnapshotLoaded) {
    return { queued: false, reason: "DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED" };
  }
  if (seenKeys.has(idempotencyKey)) return { queued: false, reason: "DUPLICATE_IDEMPOTENCY_KEY" };
  const eligibility = evaluateCandidate(candidate, approval, context);
  if (!eligibility.eligible) return { queued: false, reason: eligibility.reason };
  seenKeys.add(idempotencyKey);
  return {
    queued: true,
    message: { ...candidate, idempotency_key: idempotencyKey, status: "EN_COLA" }
  };
}

export function shouldPauseChannel({ authenticationError = false, spamComplaint = false, hardBounces = 0, attempted = 0 }) {
  const hardBounceRate = attempted > 0 ? hardBounces / attempted : 0;
  const paused = authenticationError || spamComplaint || hardBounceRate > 0.02;
  return {
    paused,
    reason: authenticationError
      ? "AUTHENTICATION_ERROR"
      : spamComplaint
        ? "SPAM_COMPLAINT"
        : hardBounceRate > 0.02
          ? "HARD_BOUNCE_RATE_ABOVE_2_PERCENT"
          : "HEALTHY",
    hardBounceRate
  };
}
