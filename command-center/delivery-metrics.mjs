const FOLDERS = new Set(["PRIMARY", "INBOX_OTHER", "PROMOTIONS", "SPAM", "UNKNOWN"]);
const AUTH = new Set(["PASS", "FAIL", "UNKNOWN"]);

function clean(value, max = 300) { return String(value ?? "").trim().slice(0, max); }

export function normalizeDeliveryTest(input = {}, now = new Date()) {
  const folder = clean(input.folder, 30).toUpperCase();
  const normalized = {
    testId: clean(input.testId ?? input.test_id, 120),
    timestamp: new Date(input.timestamp ?? now).toISOString(),
    provider: clean(input.provider || "WIS_MAILER", 40).toUpperCase(),
    mailbox: clean(input.mailbox, 180).toLowerCase(),
    seedProvider: clean(input.seedProvider ?? input.seed_provider, 40).toUpperCase(),
    folder: FOLDERS.has(folder) ? folder : "UNKNOWN",
    spf: AUTH.has(clean(input.spf, 20).toUpperCase()) ? clean(input.spf, 20).toUpperCase() : "UNKNOWN",
    dkim: AUTH.has(clean(input.dkim, 20).toUpperCase()) ? clean(input.dkim, 20).toUpperCase() : "UNKNOWN",
    dmarc: AUTH.has(clean(input.dmarc, 20).toUpperCase()) ? clean(input.dmarc, 20).toUpperCase() : "UNKNOWN",
    trackingMode: clean(input.trackingMode ?? input.tracking_mode ?? "OFF", 30).toUpperCase(),
    result: clean(input.result, 40).toUpperCase(),
    evidence: clean(input.evidence, 1000)
  };
  if (!normalized.testId || !normalized.mailbox || !normalized.seedProvider) throw new Error("DELIVERY_TEST_IDENTITY_REQUIRED");
  if (!normalized.result) normalized.result = normalized.folder === "UNKNOWN" ? "PENDING" : "OBSERVED";
  return normalized;
}

export function buildDeliveryMetrics(rows = []) {
  const normalized = [];
  for (const row of rows) {
    try { normalized.push(normalizeDeliveryTest(row)); }
    catch { /* invalid evidence never contributes to deliverability */ }
  }
  const counts = Object.fromEntries([...FOLDERS].map(folder => [folder, normalized.filter(row => row.folder === folder).length]));
  const observed = normalized.filter(row => row.folder !== "UNKNOWN").length;
  const authAligned = normalized.filter(row => row.spf === "PASS" && row.dkim === "PASS" && row.dmarc === "PASS").length;
  const byProvider = {};
  for (const row of normalized) {
    byProvider[row.seedProvider] ??= { total: 0, primary: 0, spam: 0, promotions: 0, other: 0, unknown: 0 };
    const bucket = byProvider[row.seedProvider];
    bucket.total += 1;
    if (row.folder === "PRIMARY") bucket.primary += 1;
    else if (row.folder === "SPAM") bucket.spam += 1;
    else if (row.folder === "PROMOTIONS") bucket.promotions += 1;
    else if (row.folder === "UNKNOWN") bucket.unknown += 1;
    else bucket.other += 1;
  }
  const providersObserved = Object.values(byProvider).filter(value => value.total > value.unknown).length;
  return {
    total: normalized.length,
    observed,
    counts,
    primaryRate: observed ? counts.PRIMARY / observed : 0,
    spamRate: observed ? counts.SPAM / observed : 0,
    authAlignmentRate: normalized.length ? authAligned / normalized.length : 0,
    providersObserved,
    readyForCanary: providersObserved >= 3 && observed >= 3 && counts.SPAM === 0 && authAligned === normalized.length,
    lastTestAt: normalized.map(row => row.timestamp).sort().at(-1) ?? null,
    byProvider
  };
}

