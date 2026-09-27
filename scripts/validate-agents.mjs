import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedRoles = [
  "wis-orchestrator",
  "prospect-research",
  "outreach-copy",
  "email-sender",
  "whatsapp-sender",
  "qa-ops"
];
const retiredRoles = [
  "growth-research",
  "commercial-activation",
  "content-strategy",
  "linkedin-operator",
  "x-operator",
  "web-brand",
  "automation-integrations"
];
const expectedStates = ["BACKLOG", "READY", "IN_PROGRESS", "REVIEW", "WAITING_APPROVAL", "DONE", "BLOCKED", "CANCELLED"];

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function validateExample(example, schema, label) {
  for (const key of schema.required ?? []) assert(Object.hasOwn(example, key), `${label}: falta ${key}`);
  if (example.status && schema.properties.status?.enum) {
    assert(schema.properties.status.enum.includes(example.status), `${label}: estado inválido ${example.status}`);
  }
  if (example.decision && schema.properties.decision?.enum) {
    assert(schema.properties.decision.enum.includes(example.decision), `${label}: decisión inválida ${example.decision}`);
  }
  for (const key of Object.keys(example)) {
    assert(schema.properties[key] || schema.additionalProperties !== false, `${label}: propiedad no permitida ${key}`);
  }
}

export async function validateConfiguration() {
  const registry = await readJson("agents/registry.yaml");
  const conversations = await readJson("agents/conversations.yaml");
  const policy = await readJson("agents/outreach-policy.json");
  const playbook = await fs.readFile(path.join(root, "docs/OUTREACH_COPY_PLAYBOOK.md"), "utf8");

  assert(registry.version === 2, "registry.version debe ser 2");
  assert(registry.orchestrator === "wis-orchestrator", "orquestador inválido");
  assert(registry.max_concurrent_codex_specialists === 3, "máximo Codex inválido");
  assert(registry.parallel_pipeline_workers === 4, "deben existir cuatro carriles comerciales");
  assert(JSON.stringify(registry.states) === JSON.stringify(expectedStates), "estados de tareas no canónicos");
  assert(JSON.stringify(registry.outreach_states) === JSON.stringify(policy.outreach_states), "estados outreach inconsistentes");
  assert(registry.roles.length === expectedRoles.length, "deben existir exactamente seis roles activos");

  const roleIds = registry.roles.map(role => role.id);
  assert(new Set(roleIds).size === roleIds.length, "hay roles duplicados");
  assert(expectedRoles.every(role => roleIds.includes(role)), "faltan roles requeridos");
  assert(retiredRoles.every(role => !roleIds.includes(role)), "hay roles retirados activos");

  for (const role of registry.roles) {
    for (const key of ["mission", "read_paths", "write_paths", "external_scopes", "allowed_tools", "forbidden_actions", "tests"]) {
      assert(role[key]?.length > 0, `${role.id}: falta ${key}`);
    }
    await fs.access(path.join(root, "agents", role.id, "AGENT.md"));
  }

  const conversationIds = conversations.conversations.map(item => item.thread_id);
  assert(new Set(conversationIds).size === conversationIds.length, "hay conversaciones duplicadas");
  for (const conversation of conversations.conversations) {
    assert(conversation.agents.every(role => roleIds.includes(role)), `${conversation.title}: agente inexistente`);
  }

  const expectedColumns = ["Rubro", "Empresa", "Ubicación", "WhatsApp", "Web", "Email", "Rating", "Reseñas analizadas", "Problemas", "ANALISIS NEGOCIO", "Mensaje WhatsApp", "Mensaje Email"];
  assert(JSON.stringify(policy.commercial_sheet.columns) === JSON.stringify(expectedColumns), "las 12 columnas comerciales cambiaron");
  assert(policy.operations_sheets.Outreach_Queue.includes("opt_in_source"), "falta persistencia de fuente de opt-in");
  assert(policy.operations_sheets.Outreach_Queue.includes("opt_in_recorded_at"), "falta fecha de opt-in");
  assert(policy.operations_sheets.Outreach_Queue.includes("template_id"), "falta template de WhatsApp");
  assert(policy.batch_size === 25, "el lote debe ser de 25");
  assert(policy.email.daily_cap === 25 && policy.whatsapp.daily_cap === 10, "caps de canal inválidos");
  assert(policy.email.interval_minutes === 15 && policy.whatsapp.interval_minutes === 15, "intervalos inválidos");
  assert(policy.whatsapp.verified_opt_in_required && !policy.whatsapp.cold_outreach_allowed, "opt-in no obligatorio");
  assert(policy.pause_rules.hard_bounce_rate_above === 0.02, "umbral de hard bounce inválido");
  assert(policy.copy.variant_a_anchor.startsWith("Sé que no nos conocemos"), "ancla A inválida");
  assert(policy.copy.single_variable_per_test, "A/B debe cambiar una variable");
  const templates = playbook.split("## Control previo a QA")[0];
  assert(templates.includes("Sé que no nos conocemos"), "falta la apertura A");
  assert(templates.includes("En las valoraciones públicas"), "falta la apertura B");
  assert(templates.includes("[día 1]") && templates.includes("[día 2]"), "faltan dos horarios");
  assert(!templates.includes("En WIS armamos automatizaciones"), "el template usa una frase prohibida");
  assert(!templates.includes("¿"), "el template usa signo inicial de interrogación");

  const schemas = {
    task: await readJson("agents/contracts/task.schema.json"),
    run: await readJson("agents/contracts/run.schema.json"),
    handoff: await readJson("agents/contracts/handoff.schema.json"),
    approval: await readJson("agents/contracts/approval.schema.json"),
    batchApproval: await readJson("agents/contracts/batch-approval.schema.json"),
    outreachMessage: await readJson("agents/contracts/outreach-message.schema.json"),
    outreachEvent: await readJson("agents/contracts/outreach-event.schema.json")
  };
  validateExample(await readJson("agents/examples/task.revenue-research.json"), schemas.task, "task example");
  validateExample(await readJson("agents/examples/run.revenue-research.json"), schemas.run, "run example");
  validateExample(await readJson("agents/examples/handoff.research-to-qa.json"), schemas.handoff, "handoff example");
  validateExample(await readJson("agents/examples/approval.external-send.json"), schemas.approval, "approval example");
  validateExample(await readJson("agents/examples/approval.canary-email.json"), schemas.batchApproval, "batch approval example");
  validateExample(await readJson("agents/examples/outreach.whatsapp-optin.json"), schemas.outreachMessage, "outreach message example");
  validateExample(await readJson("agents/examples/event.outcome-unknown.json"), schemas.outreachEvent, "outreach event example");
  assert(schemas.outreachEvent.properties.event_type.enum.includes("OPT_IN_RECORDED"), "falta evento durable de opt-in");

  return { roleCount: roleIds.length, conversationCount: conversationIds.length, contractCount: Object.keys(schemas).length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await validateConfiguration();
  console.log(`Agent configuration valid: ${result.roleCount} roles, ${result.conversationCount} conversations, ${result.contractCount} contracts.`);
}
