import fs from "node:fs/promises";
import dns from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const valueAfter = flag => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function loadEnvFile(file) {
  if (!file) return {};
  const raw = await fs.readFile(file, "utf8");
  return Object.fromEntries(raw.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#") && line.includes("=")).map(line => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
}

async function txt(name) {
  try { return (await dns.resolveTxt(name)).map(parts => parts.join("")); }
  catch (error) { return error.code === "ENOTFOUND" || error.code === "ENODATA" ? [] : [`LOOKUP_ERROR:${error.code ?? "UNKNOWN"}`]; }
}

async function cname(name) {
  try { return await dns.resolveCname(name); }
  catch (error) { return error.code === "ENOTFOUND" || error.code === "ENODATA" ? [] : [`LOOKUP_ERROR:${error.code ?? "UNKNOWN"}`]; }
}

async function dnsAudit() {
  const root = await txt("wis-agency.com");
  const dmarc = await txt("_dmarc.wis-agency.com");
  const mx = await dns.resolveMx("wis-agency.com").catch(() => []);
  const selectors = ["google", "default", "mail", "brevo", "sib"];
  const dkim = Object.fromEntries(await Promise.all(selectors.map(async selector => {
    const host = `${selector}._domainkey.wis-agency.com`;
    return [selector, { txt: await txt(host), cname: await cname(host) }];
  })));
  return {
    mx: mx.map(record => record.exchange).sort(),
    spf: root.filter(record => record.toLowerCase().startsWith("v=spf1")),
    dmarc: dmarc.filter(record => record.toLowerCase().startsWith("v=dmarc1")),
    dkim_common_selectors: Object.fromEntries(Object.entries(dkim).map(([selector, records]) => [selector, records.txt.length > 0 || records.cname.length > 0 ? "FOUND" : "NOT_FOUND"])),
    note: "A NOT_FOUND result on common selectors does not prove DKIM is absent; the authoritative selector is required."
  };
}

function classifyScope(name = "") {
  if (/dugas|qh|bora|mundovera/i.test(name)) return "FOREIGN_DO_NOT_REUSE";
  if (/wis.*(?:email|gmail|brevo)|(?:email|gmail|brevo).*wis/i.test(name)) return "WIS_EMAIL";
  return "UNCLASSIFIED";
}

async function n8nAudit(env) {
  const configuredBase = String(env.N8N_API_BASE_URL || "").replace(/\/$/, "");
  if (!configuredBase || !env.N8N_API_KEY) return { status: "NOT_CHECKED", reason: "N8N_READ_ONLY_CREDENTIALS_UNAVAILABLE" };
  const apiRoot = /\/api\/v1$/i.test(configuredBase) ? configuredBase : `${configuredBase}/api/v1`;
  const headers = { "X-N8N-API-KEY": env.N8N_API_KEY };
  const get = async suffix => {
    const response = await fetch(`${apiRoot}${suffix}`, { headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`n8n_${response.status}`);
    return response.json();
  };
  const list = await get("/workflows?limit=250");
  const summaries = [];
  for (const row of list.data ?? []) {
    const workflow = await get(`/workflows/${encodeURIComponent(row.id)}`);
    const emailNodes = (workflow.nodes ?? []).filter(node => /gmail|sendinblue|brevo|emailSend/i.test(node.type ?? "") || /gmail|brevo|send email/i.test(node.name ?? ""));
    if (!emailNodes.length) continue;
    summaries.push({
      workflow_id: workflow.id,
      scope: classifyScope(workflow.name),
      active: workflow.active === true,
      email_node_types: [...new Set(emailNodes.map(node => node.type))],
      credential_reference_types: [...new Set(emailNodes.flatMap(node => Object.keys(node.credentials ?? {})))],
      target_alias_referenced: JSON.stringify(emailNodes).toLowerCase().includes("ortu@wis-agency.com")
    });
  }
  const recentExecutions = [];
  for (const workflow of summaries) {
    const executions = await get(`/executions?workflowId=${encodeURIComponent(workflow.workflow_id)}&limit=5`);
    recentExecutions.push(...(executions.data ?? []).map(row => ({ status: row.status, started_at: row.startedAt })));
  }
  const executionStatusCounts = Object.fromEntries([...new Set(recentExecutions.map(row => row.status ?? "unknown"))].map(status => [status, recentExecutions.filter(row => (row.status ?? "unknown") === status).length]));
  return {
    status: "CHECKED",
    workflow_count: (list.data ?? []).length,
    email_workflows: summaries.length,
    active_email_workflows: summaries.filter(item => item.active).length,
    wis_email_workflows: summaries.filter(item => item.scope === "WIS_EMAIL").length,
    foreign_email_workflows: summaries.filter(item => item.scope === "FOREIGN_DO_NOT_REUSE").length,
    target_alias_referenced: summaries.some(item => item.target_alias_referenced),
    credential_reference_types: [...new Set(summaries.flatMap(item => item.credential_reference_types))],
    recent_execution_count: recentExecutions.length,
    recent_execution_statuses: executionStatusCounts,
    last_email_execution_at: recentExecutions.map(row => row.started_at).filter(Boolean).sort().at(-1) ?? null
  };
}

async function brevoAudit(env) {
  if (!env.BREVO_API_KEY) return { status: "NOT_CHECKED", reason: "BREVO_READ_ONLY_CREDENTIAL_UNAVAILABLE" };
  const response = await fetch("https://api.brevo.com/v3/senders", { headers: { "api-key": env.BREVO_API_KEY, accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return { status: "ERROR", http_status: response.status };
  const body = await response.json();
  const senders = Array.isArray(body) ? body : body.senders ?? [];
  const target = senders.find(sender => String(sender.email ?? "").toLowerCase() === "ortu@wis-agency.com");
  return {
    status: "CHECKED",
    target_sender_found: Boolean(target),
    target_sender_active: target ? target.active === true : false,
    target_sender_name_matches: target ? target.name === "Ortu - WIS" : false
  };
}

const config = JSON.parse(await fs.readFile(valueAfter("--config") ?? path.join(here, "config.disabled.json"), "utf8"));
const fileEnv = await loadEnvFile(valueAfter("--env-file"));
const env = { ...fileEnv, ...process.env };
const live = args.has("--live-read-only");
const report = {
  checked_at: new Date().toISOString(),
  mode: live ? "LIVE_READ_ONLY" : "PUBLIC_DNS_ONLY",
  config_guard: {
    enabled: config.enabled,
    dry_run: config.dry_run,
    deployment_mode: config.deployment_mode,
    alias_verification: config.sender.alias_verification,
    signature_approval_status: config.signature.approval_status
  },
  dns: await dnsAudit(),
  n8n: live ? await n8nAudit(env) : { status: "NOT_CHECKED", reason: "LIVE_READ_ONLY_NOT_REQUESTED" },
  brevo: live ? await brevoAudit(env) : { status: "NOT_CHECKED", reason: "LIVE_READ_ONLY_NOT_REQUESTED" },
  gmail: {
    alias_status: "NOT_CHECKED",
    reason: "No read-only Gmail alias API credential was available; a workflow credential reference is not proof that the alias is currently authorized."
  }
};

console.log(JSON.stringify(report, null, 2));
