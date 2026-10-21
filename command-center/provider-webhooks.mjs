import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ""), "utf8");
  const b = Buffer.from(String(right ?? ""), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function timestampMillis(value) {
  const text = String(value ?? "").trim();
  if (!text) return Number.NaN;
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    return text.length <= 10 ? numeric * 1000 : numeric;
  }
  return Date.parse(text);
}

function verifyWisSignedWebhook({ headers = {}, rawBody = "", secret, now = Date.now(), toleranceMs = 5 * 60_000, invalidCode }) {
  if (!secret) throw Object.assign(new Error("PROVIDER_WEBHOOK_DISABLED"), { status: 503 });
  const eventId = String(headers["x-wis-event-id"] ?? "").trim();
  const timestamp = String(headers["x-wis-timestamp"] ?? "").trim();
  const supplied = String(headers["x-wis-signature"] ?? "").trim().toLowerCase();
  const parsed = timestampMillis(timestamp);
  if (!eventId || !timestamp || !supplied || !Number.isFinite(parsed) || Math.abs(now - parsed) > toleranceMs) {
    throw Object.assign(new Error(invalidCode), { status: 401 });
  }
  const expectedHex = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expected = `sha256=${expectedHex}`;
  if (!safeEqual(supplied, expected)) {
    throw Object.assign(new Error(invalidCode), { status: 401 });
  }
  return { eventId, timestamp };
}

export function verifyWisWhatsAppWebhook(input) {
  return verifyWisSignedWebhook({ ...input, invalidCode: "WHATSAPP_WEBHOOK_SIGNATURE_INVALID" });
}

export function verifyWisEmailWebhook(input) {
  return verifyWisSignedWebhook({ ...input, invalidCode: "EMAIL_WEBHOOK_SIGNATURE_INVALID" });
}

export function parseJsonBody(rawBody) {
  try { return rawBody ? JSON.parse(rawBody) : {}; }
  catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}
