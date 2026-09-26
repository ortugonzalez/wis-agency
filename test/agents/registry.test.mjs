import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateConfiguration } from "../../scripts/validate-agents.mjs";

test("registry defines nine valid roles and four contracts", async () => {
  const result = await validateConfiguration();
  assert.equal(result.roleCount, 9);
  assert.equal(result.contractCount, 4);
  assert.equal(result.conversationCount, 12);
});

test("all external side effects have human approval gates", async () => {
  const registry = JSON.parse(await fs.readFile(new URL("../../agents/registry.yaml", import.meta.url), "utf8"));
  const required = [
    "send_message",
    "publish_or_delete_social_post",
    "activate_or_reschedule_automation",
    "deploy",
    "production_migration_or_destructive_data_change",
    "credential_or_permission_change",
    "live_side_effect_test",
  ];
  assert.deepEqual(registry.human_approval_actions, required);
});

test("safe defaults are explicit in project instructions", async () => {
  const instructions = await fs.readFile(new URL("../../AGENTS.md", import.meta.url), "utf8");
  for (const flag of ["SYSTEM_ENABLED=false", "AUTO_PUBLISH=false", "X_SYSTEM_ENABLED=false", "X_AUTO_PUBLISH_ONE_SHOT=false", "X_DRY_RUN=true"]) {
    assert.match(instructions, new RegExp(flag.replaceAll("_", "[_]")));
  }
});

