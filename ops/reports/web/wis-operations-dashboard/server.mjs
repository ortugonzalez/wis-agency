import { createServer } from "node:http";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const publicDir = join(root, "ops", "reports", "web", "wis-operations-dashboard", "out");
const configDir = join(root, "ops", "config");
const runtimeDir = join(root, "ops", "runtime");
const commandsPath = join(runtimeDir, "dashboard-commands.ndjson");
const schedulesPath = join(runtimeDir, "schedules.local.json");
const statePath = join(configDir, "dashboard-state.json");
const defaultSchedulesPath = join(configDir, "schedules.default.json");
const port = Number(process.env.WIS_DASHBOARD_PORT || 4174);
const allowedActions = new Set(["CONTINUE_RESEARCH", "RUN_QA", "REFRESH_SNAPSHOT", "PREPARE_DRAFTS"]);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" };

await mkdir(runtimeDir, { recursive: true });

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function readCommands() {
  try {
    return (await readFile(commandsPath, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line)).slice(-50).reverse();
  } catch { return []; }
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error("PAYLOAD_TOO_LARGE");
  }
  return raw ? JSON.parse(raw) : {};
}

function json(res, status, value) {
  res.writeHead(status, { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" });
  res.end(JSON.stringify(value));
}

function safeSchedule(input, existing) {
  const mode = input.mode === "DAILY" ? "DAILY" : "EVERY_N_MINUTES";
  const intervalMinutes = mode === "EVERY_N_MINUTES" ? Math.max(5, Math.min(1440, Number(input.intervalMinutes) || 60)) : null;
  const dailyTime = mode === "DAILY" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.dailyTime || "") ? input.dailyTime : mode === "DAILY" ? "09:30" : null;
  return { ...existing, mode, intervalMinutes, dailyTime, status: input.status === "ACTIVE" ? "ACTIVE" : "PAUSED" };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/state" && req.method === "GET") {
      const [state, defaults, local, commands] = await Promise.all([
        readJson(statePath, {}), readJson(defaultSchedulesPath, { schedules:[] }), readJson(schedulesPath, null), readCommands()
      ]);
      return json(res, 200, { ...state, schedules: (local || defaults).schedules, commands, serverTime: new Date().toISOString(), controlMode:"LOCAL_QUEUE" });
    }
    if (url.pathname === "/api/actions" && req.method === "POST") {
      const input = await body(req);
      if (!allowedActions.has(input.action)) return json(res, 400, { ok:false, error:"ACTION_NOT_ALLOWED" });
      const idempotencyKey = String(input.idempotencyKey || `${input.action}:${new Date().toISOString().slice(0, 16)}`).slice(0, 180);
      const existing = (await readCommands()).find(item => item.idempotencyKey === idempotencyKey);
      if (existing) return json(res, 200, { ok:true, command:existing, deduplicated:true, note:"La orden ya estaba registrada; no se creó un duplicado." });
      const command = {
        commandId: `CMD-${Date.now()}-${randomUUID().slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        action: input.action,
        scope: String(input.scope || "NEXT_PENDING_BATCH").slice(0, 120),
        source: "WIS_DASHBOARD",
        requestedBy: "human-local",
        status: "NEW",
        idempotencyKey
      };
      await appendFile(commandsPath, `${JSON.stringify(command)}\n`, "utf8");
      return json(res, 202, { ok:true, command, note:"La orden quedó registrada. No realiza envíos ni activa proveedores." });
    }
    if (url.pathname.startsWith("/api/schedules/") && req.method === "PATCH") {
      const input = await body(req);
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const defaults = await readJson(defaultSchedulesPath, { schedules:[] });
      const current = await readJson(schedulesPath, defaults);
      const index = current.schedules.findIndex(item => item.id === id);
      if (index < 0) return json(res, 404, { ok:false, error:"SCHEDULE_NOT_FOUND" });
      current.schedules[index] = safeSchedule(input, current.schedules[index]);
      await writeFile(schedulesPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
      return json(res, 200, { ok:true, schedule:current.schedules[index], note:"La programación local no envía mensajes; sólo registra tareas cuando el ejecutor sea conectado." });
    }
    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = normalize(join(publicDir, requested));
    if (!file.startsWith(publicDir)) return json(res, 403, { error:"FORBIDDEN" });
    const bytes = await readFile(file);
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream", "cache-control":"no-store" });
    res.end(bytes);
  } catch (error) {
    if (error?.code === "ENOENT") return json(res, 404, { error:"NOT_FOUND" });
    return json(res, 500, { error:"SERVER_ERROR" });
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`WIS dashboard: http://127.0.0.1:${port}/#overview\n`);
});
