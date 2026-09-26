import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedRoles = [
  "wis-orchestrator",
  "growth-research",
  "commercial-activation",
  "content-strategy",
  "linkedin-operator",
  "x-operator",
  "web-brand",
  "automation-integrations",
  "qa-ops",
];
const expectedStates = [
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "REVIEW",
  "WAITING_APPROVAL",
  "DONE",
  "BLOCKED",
  "CANCELLED",
];

async function readJson(relativePath) {
  const value = await fs.readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateExample(example, schema, label) {
  for (const key of schema.required ?? []) {
    assert(Object.hasOwn(example, key), `${label}: falta ${key}`);
  }
  if (example.status && schema.properties.status?.enum) {
    assert(schema.properties.status.enum.includes(example.status), `${label}: estado inválido ${example.status}`);
  }
}

export async function validateConfiguration() {
  const registry = await readJson("agents/registry.yaml");
  const conversations = await readJson("agents/conversations.yaml");

  assert(registry.version === 1, "registry.version debe ser 1");
  assert(registry.orchestrator === "wis-orchestrator", "orquestador inválido");
  assert(registry.max_concurrent_specialists === 3, "el máximo de especialistas debe ser 3");
  assert(JSON.stringify(registry.states) === JSON.stringify(expectedStates), "estados no canónicos");
  assert(registry.roles.length === expectedRoles.length, "deben existir exactamente nueve roles");

  const roleIds = registry.roles.map((role) => role.id);
  assert(new Set(roleIds).size === roleIds.length, "hay roles duplicados");
  assert(expectedRoles.every((role) => roleIds.includes(role)), "faltan roles requeridos");

  for (const role of registry.roles) {
    for (const key of ["mission", "read_paths", "write_paths", "external_scopes", "allowed_tools", "forbidden_actions", "tests"]) {
      assert(role[key] && role[key].length > 0, `${role.id}: falta ${key}`);
    }
    await fs.access(path.join(root, "agents", role.id, "AGENT.md"));
  }

  const conversationIds = conversations.conversations.map((item) => item.thread_id);
  assert(new Set(conversationIds).size === conversationIds.length, "hay conversaciones duplicadas");
  for (const conversation of conversations.conversations) {
    assert(conversation.agents.every((role) => roleIds.includes(role)), `${conversation.title}: agente inexistente`);
  }

  const schemas = {
    task: await readJson("agents/contracts/task.schema.json"),
    run: await readJson("agents/contracts/run.schema.json"),
    handoff: await readJson("agents/contracts/handoff.schema.json"),
    approval: await readJson("agents/contracts/approval.schema.json"),
  };
  validateExample(await readJson("agents/examples/task.revenue-research.json"), schemas.task, "task example");
  validateExample(await readJson("agents/examples/run.revenue-research.json"), schemas.run, "run example");
  validateExample(await readJson("agents/examples/handoff.research-to-qa.json"), schemas.handoff, "handoff example");
  validateExample(await readJson("agents/examples/approval.external-send.json"), schemas.approval, "approval example");

  return { roleCount: roleIds.length, conversationCount: conversationIds.length, contractCount: Object.keys(schemas).length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await validateConfiguration();
  console.log(`Agent configuration valid: ${result.roleCount} roles, ${result.conversationCount} conversations, ${result.contractCount} contracts.`);
}

