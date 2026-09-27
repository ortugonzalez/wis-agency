import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateConfiguration } from "../../scripts/validate-agents.mjs";

test("registry defines six commercial roles and seven contracts", async () => {
  const result = await validateConfiguration();
  assert.equal(result.roleCount, 6);
  assert.equal(result.contractCount, 7);
  assert.equal(result.conversationCount, 6);
});

test("only commercial external effects remain behind human approval", async () => {
  const registry = JSON.parse(await fs.readFile(new URL("../../agents/registry.yaml", import.meta.url), "utf8"));
  assert.deepEqual(registry.human_approval_actions, [
    "send_email",
    "send_whatsapp",
    "activate_or_reschedule_automation",
    "deploy",
    "production_migration_or_destructive_data_change",
    "credential_or_permission_change",
    "live_side_effect_test"
  ]);
  const active = new Set(registry.roles.map(role => role.id));
  for (const retired of ["content-strategy", "linkedin-operator", "x-operator", "web-brand", "automation-integrations"]) {
    assert.equal(active.has(retired), false);
  }
});

test("retired code is preserved but documented as inactive", async () => {
  const separation = await fs.readFile(new URL("../../docs/PROJECT_SEPARATION.md", import.meta.url), "utf8");
  for (const role of ["LinkedIn", "X", "contenido", "web"]) assert.match(separation.toLowerCase(), new RegExp(role.toLowerCase()));
});

test("commercial sheet contract keeps exactly twelve columns", async () => {
  const policy = JSON.parse(await fs.readFile(new URL("../../agents/outreach-policy.json", import.meta.url), "utf8"));
  assert.deepEqual(policy.commercial_sheet.columns, [
    "Rubro", "Empresa", "Ubicación", "WhatsApp", "Web", "Email",
    "Rating", "Reseñas analizadas", "Problemas", "ANALISIS NEGOCIO",
    "Mensaje WhatsApp", "Mensaje Email"
  ]);
});
