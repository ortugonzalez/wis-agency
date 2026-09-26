# WIS BOTS multi-agent operating rules

This repository coordinates WIS commercial, content, channel, web, automation, and QA work. Role definitions live in `agents/registry.yaml` and `agents/<role>/AGENT.md`.

## Operating model

- The root agent is `wis-orchestrator`.
- Use no more than three active specialist subagents at a time.
- Delegate only independent tasks with an explicit expected output and write scope.
- Keep short or dependency-bound steps in the orchestrator.
- Never assign two agents to the same writable path, spreadsheet range, workflow, or external record.
- Definitions in this repository are authoritative. Live queue and execution state belong in the `WIS · Operaciones de Agentes` Google Sheet.
- Use the existing Codex conversations only as source context. Do not archive, duplicate, or send messages to them unless the user requests it.

## Human approval gates

The following actions must stop in `WAITING_APPROVAL` with evidence and a clear description of impact:

- sending WhatsApp, email, Telegram, LinkedIn, or X messages;
- publishing or deleting social posts;
- activating or changing schedules, n8n workflows, production flags, webhooks, or automations;
- deploying a website or service;
- applying production database migrations or destructive data changes;
- changing credentials, permissions, billing, or external account settings;
- running a test that creates live executions, messages, records, or browser publication attempts.

Research, drafting, local tests, read-only inspection, and writes explicitly requested in business or operations Sheets are allowed when they remain inside the task's declared scope.

## Safety invariants

- Never place credentials, cookies, tokens, browser state, QR codes, or secret-bearing logs in Git, Sheets, task handoffs, or chat.
- Keep LinkedIn production gates disabled unless a human approves the exact action: `SYSTEM_ENABLED=false` and `AUTO_PUBLISH=false`.
- Keep X safe defaults: `X_SYSTEM_ENABLED=false`, `X_AUTO_PUBLISH_ONE_SHOT=false`, and `X_DRY_RUN=true`.
- Preserve idempotency. Treat timeouts or ambiguous publishing results as `outcome_unknown`; reconcile before any retry.
- Do not guess WhatsApp numbers, email addresses, review counts, research evidence, or task completion.
- Prospect review analysis covers only 1–3 star reviews and records `analizadas/total accesible`.
- Do not add columns to commercial Sheets without explicit user instruction.

## Git and worktrees

- The root repository owns orchestration, LinkedIn root scripts, and `wis_x`.
- `wis-agency` and other nested repositories retain their own Git history and are not tracked by the root repository.
- Code tasks use an isolated worktree and a branch named `codex/<role>-<task_id>`.
- Do not create a worktree from a dirty repository. Preserve user changes and report overlaps.
- The orchestrator integrates only after owner tests and an independent `qa-ops` review.
- `qa-ops` writes findings and test artifacts; it does not silently patch the code it reviews.

## Commands

- Prefix shell commands with `rtk`.
- Prefer read-only audits before live or side-effectful tests.
- Run `rtk npm test` at repository root after changing agent definitions.
- For X changes, also run `rtk npm test` inside `wis_x`.
- LinkedIn live/control scripts require an approved task because they may create n8n, Supabase, or Telegram activity even when publication is blocked.

## Task lifecycle

Allowed states are `BACKLOG`, `READY`, `IN_PROGRESS`, `REVIEW`, `WAITING_APPROVAL`, `DONE`, `BLOCKED`, and `CANCELLED`.

Only `wis-orchestrator` assigns an owner or changes lifecycle state. Specialists append evidence and a handoff. `qa-ops` records an independent review. A human decides external side effects.

