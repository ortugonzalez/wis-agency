import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

export const TELEGRAM_CHANNEL_LIMITS = Object.freeze({ EMAIL: 25, WHATSAPP: 10 });

const normalize = value => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9+\s_-]/g, " ").replace(/\s+/g, " ").trim();
const sha256 = value => createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
const iso = value => new Date(value).toISOString();

function fault(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyTelegramWebhookSecret(headers = {}, expectedSecret = "") {
  if (!expectedSecret) throw fault("TELEGRAM_WEBHOOK_DISABLED", 503);
  const supplied = headers["x-telegram-bot-api-secret-token"] ?? headers.get?.("x-telegram-bot-api-secret-token");
  if (!secureEqual(supplied, expectedSecret)) throw fault("TELEGRAM_WEBHOOK_SECRET_INVALID", 401);
  return true;
}

export function parseTelegramAllowlist(value) {
  return new Set(String(value ?? "").split(",").map(item => item.trim()).filter(item => /^\d+$/.test(item)));
}

function requestedQuantity(text) {
  const match = text.match(/\b(\d{1,4})\b/);
  return match ? Number(match[1]) : null;
}

function commandBase({ transcript, actor, sourceMessageId }) {
  return {
    commandId: randomUUID(),
    source: "TELEGRAM",
    sourceMessageId: String(sourceMessageId ?? "").trim(),
    actor: String(actor ?? "").trim(),
    transcriptHash: sha256(normalize(transcript)),
    externalEffect: false,
    requiresHumanApproval: true,
    status: "WAITING_APPROVAL"
  };
}

export function interpretTelegramCommand({ transcript, actor, sourceMessageId } = {}) {
  const text = normalize(transcript);
  const base = commandBase({ transcript, actor, sourceMessageId });
  if (!text) return { ...base, action: "UNRECOGNIZED", status: "BLOCKED", reason: "EMPTY_TRANSCRIPT" };

  const confirmation = text.match(/^confirmar\s+([a-z0-9_-]{8,80})$/);
  if (confirmation) return { ...base, action: "CONFIRM_APPROVAL_TOKEN", confirmationToken: confirmation[1], status: "READY" };
  const approval = text.match(/\baproba(?:r)?\s+(?:el\s+)?lote\s+([a-z0-9_-]{1,80})\b/);
  if (approval) return { ...base, action: "REQUEST_BATCH_APPROVAL", batchId: approval[1].toUpperCase(), status: "WAITING_CONFIRMATION" };
  const cancellation = text.match(/\bcancela(?:r)?\s+(?:el\s+)?lote\s+([a-z0-9_-]{1,80})\b/);
  if (cancellation) return { ...base, action: "CANCEL_BATCH", batchId: cancellation[1].toUpperCase(), status: "READY", requiresHumanApproval: false };

  if (/\b(estado general|estado|status|avance|resumen)\b/.test(text)) {
    return { ...base, action: "READ_PIPELINE_STATUS", status: "READY", requiresHumanApproval: false };
  }
  if (/\b(pausa|pausar|detene|detener|frena|frenar)\b/.test(text)) {
    const channel = /\b(whatsapp|wsp|whats app)\b/.test(text) ? "WHATSAPP" :
      /\b(mail|mails|email|emails|correo|correos)\b/.test(text) ? "EMAIL" : "ALL";
    return { ...base, action: "REQUEST_PIPELINE_PAUSE", channel, status: "READY", requiresHumanApproval: false };
  }

  const channel = /\b(whatsapp|wsp|whats app)\b/.test(text) ? "WHATSAPP" :
    /\b(mail|mails|email|emails|correo|correos)\b/.test(text) ? "EMAIL" : null;
  const quantity = requestedQuantity(text);
  const asksPrepare = /\b(prepara|preparar|arma|armar|manda|mandar|envia|enviar|envie|despacha|despachar)\b/.test(text);
  if (!channel || !asksPrepare || !quantity) {
    return { ...base, action: "UNRECOGNIZED", status: "BLOCKED", reason: "AMBIGUOUS_COMMAND" };
  }
  if (quantity < 1 || quantity > TELEGRAM_CHANNEL_LIMITS[channel]) {
    return { ...base, action: `PREPARE_${channel}_BATCH`, channel, requestedQuantity: quantity,
      status: "BLOCKED", reason: "CHANNEL_LIMIT_EXCEEDED", allowedMaximum: TELEGRAM_CHANNEL_LIMITS[channel] };
  }
  return { ...base, action: `PREPARE_${channel}_BATCH`, channel, requestedQuantity: quantity,
    note: "Sólo prepara elegibles y vista previa. Enviar exige QA y una segunda confirmación exacta." };
}

function freshState() {
  return { schemaVersion: 1, updates: {}, commands: [], confirmations: {} };
}

export class PersistentTelegramCommandStore {
  constructor({ statePath, retentionDays = 30, clock = () => new Date() }) {
    if (!statePath) throw fault("TELEGRAM_STATE_PATH_REQUIRED");
    this.statePath = resolve(statePath);
    this.lockPath = `${this.statePath}.lock`;
    this.retentionDays = retentionDays;
    this.clock = clock;
  }

  async #read() {
    try {
      const state = JSON.parse(await readFile(this.statePath, "utf8"));
      if (state?.schemaVersion !== 1 || typeof state.updates !== "object" || !Array.isArray(state.commands)) throw fault("TELEGRAM_STATE_INVALID");
      state.confirmations ??= {};
      return state;
    } catch (error) {
      if (error.code === "ENOENT") return freshState();
      throw error;
    }
  }

  async #write(state) {
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, this.statePath);
  }

  async #mutate(operation) {
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    let lock;
    try { lock = await open(this.lockPath, "wx", 0o600); }
    catch (error) { if (error.code === "EEXIST") throw fault("TELEGRAM_STORE_BUSY", 409); throw error; }
    try {
      const state = await this.#read();
      const cutoff = this.clock().getTime() - this.retentionDays * 86_400_000;
      for (const [id, item] of Object.entries(state.updates)) if (new Date(item.at).getTime() < cutoff) delete state.updates[id];
      for (const [token, item] of Object.entries(state.confirmations)) if (new Date(item.expiresAt).getTime() < this.clock().getTime()) delete state.confirmations[token];
      state.commands = state.commands.filter(item => new Date(item.receivedAt).getTime() >= cutoff);
      const result = await operation(state);
      await this.#write(state);
      return structuredClone(result);
    } finally {
      await lock.close();
      await rm(this.lockPath, { force: true });
    }
  }

  async hasUpdate(updateId) {
    const state = await this.#read();
    return state.updates[String(updateId)] ?? null;
  }

  async record({ updateId, command, inputKind }) {
    return this.#mutate(state => {
      const id = String(updateId);
      if (state.updates[id]) return { duplicate: true, command: state.updates[id].command };
      const receivedAt = iso(this.clock());
      let safeCommand = { ...command, receivedAt, inputKind };
      if (safeCommand.action === "REQUEST_BATCH_APPROVAL") {
        const confirmationToken = randomUUID().replaceAll("-", "").slice(0, 12);
        const expiresAt = iso(this.clock().getTime() + 10 * 60_000);
        state.confirmations[confirmationToken] = { actor: safeCommand.actor, batchId: safeCommand.batchId, createdAt: receivedAt, expiresAt, used: false };
        safeCommand = { ...safeCommand, confirmationToken, confirmationExpiresAt: expiresAt,
          confirmationInstruction: `confirmar ${confirmationToken}` };
      } else if (safeCommand.action === "CONFIRM_APPROVAL_TOKEN") {
        const pending = state.confirmations[safeCommand.confirmationToken];
        if (!pending || pending.used || pending.actor !== safeCommand.actor || new Date(pending.expiresAt) <= this.clock()) {
          safeCommand = { ...safeCommand, action: "CONFIRMATION_REJECTED", status: "BLOCKED", reason: "CONFIRMATION_INVALID_OR_EXPIRED" };
        } else {
          pending.used = true;
          pending.usedAt = receivedAt;
          safeCommand = { ...safeCommand, action: "APPROVE_BATCH", batchId: pending.batchId, status: "READY",
            requiresHumanApproval: false, confirmationValidated: true };
        }
      } else if (safeCommand.action === "CANCEL_BATCH") {
        for (const pending of Object.values(state.confirmations)) if (pending.batchId === safeCommand.batchId) pending.used = true;
      }
      state.updates[id] = { at: receivedAt, command: safeCommand };
      state.commands.push(safeCommand);
      return { duplicate: false, command: safeCommand };
    });
  }

  async snapshot() { return structuredClone(await this.#read()); }
}

async function transcribeVoice({ fileId, telegramToken, openAiApiKey, fetchImpl = fetch, temporaryDirectory = tmpdir() }) {
  if (!telegramToken) throw fault("TELEGRAM_BOT_TOKEN_MISSING", 503);
  if (!openAiApiKey) throw fault("OPENAI_API_KEY_MISSING", 503);
  const metadataResponse = await fetchImpl(`https://api.telegram.org/bot${telegramToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const metadata = await metadataResponse.json();
  if (!metadataResponse.ok || !metadata.ok || !metadata.result?.file_path) throw fault("TELEGRAM_FILE_LOOKUP_FAILED", 502);
  const audioResponse = await fetchImpl(`https://api.telegram.org/file/bot${telegramToken}/${metadata.result.file_path}`);
  if (!audioResponse.ok) throw fault("TELEGRAM_FILE_DOWNLOAD_FAILED", 502);
  const bytes = Buffer.from(await audioResponse.arrayBuffer());
  if (bytes.length > 25 * 1024 * 1024) throw fault("TELEGRAM_AUDIO_TOO_LARGE", 413);
  await mkdir(temporaryDirectory, { recursive: true });
  const temporaryPath = join(temporaryDirectory, `wis-telegram-${randomUUID()}.ogg`);
  await writeFile(temporaryPath, bytes, { mode: 0o600, flag: "wx" });
  try {
    const form = new FormData();
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: "audio/ogg" }), "command.ogg");
    form.append("language", "es");
    const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { authorization: `Bearer ${openAiApiKey}` }, body: form
    });
    const body = await response.json();
    if (!response.ok || !body.text) throw fault("TELEGRAM_TRANSCRIPTION_FAILED", 502);
    return body.text;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export class TelegramWebhookService {
  constructor({ store, webhookSecret, allowedUserIds, telegramToken, openAiApiKey, fetchImpl = fetch, temporaryDirectory, onCommand = async () => {} }) {
    this.store = store;
    this.webhookSecret = webhookSecret;
    this.allowedUserIds = allowedUserIds instanceof Set ? allowedUserIds : parseTelegramAllowlist(allowedUserIds);
    this.telegramToken = telegramToken;
    this.openAiApiKey = openAiApiKey;
    this.fetchImpl = fetchImpl;
    this.temporaryDirectory = temporaryDirectory;
    this.onCommand = onCommand;
  }

  async process(headers, update) {
    verifyTelegramWebhookSecret(headers, this.webhookSecret);
    if (!Number.isInteger(update?.update_id)) throw fault("TELEGRAM_UPDATE_ID_INVALID");
    const previous = await this.store.hasUpdate(update.update_id);
    if (previous) return { ok: true, duplicate: true, command: previous.command };
    const message = update.message ?? update.edited_message;
    const actor = String(message?.from?.id ?? "");
    if (!this.allowedUserIds.has(actor)) throw fault("TELEGRAM_USER_NOT_ALLOWED", 403);
    let transcript = String(message?.text ?? "").trim();
    let inputKind = "TEXT";
    if (!transcript && message?.voice?.file_id) {
      inputKind = "VOICE";
      transcript = await transcribeVoice({ fileId: message.voice.file_id, telegramToken: this.telegramToken,
        openAiApiKey: this.openAiApiKey, fetchImpl: this.fetchImpl, temporaryDirectory: this.temporaryDirectory });
    }
    const command = interpretTelegramCommand({ transcript, actor, sourceMessageId: message?.message_id });
    const recorded = await this.store.record({ updateId: update.update_id, command, inputKind });
    if (!recorded.duplicate) await this.onCommand(recorded.command);
    return { ok: true, duplicate: recorded.duplicate, command: recorded.command };
  }
}

export { sha256 as telegramSha256 };
