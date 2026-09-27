# WIS BOTS commercial outreach operating rules

This repository coordinates one commercial pipeline: prospect research, personalized copy, approved email delivery, opted-in WhatsApp delivery, orchestration, and independent QA. Active roles live in `agents/registry.yaml`.

## Operating model

- The root agent is `wis-orchestrator`.
- Codex may run at most three specialist subagents at once. The business pipeline exposes four concurrent lanes: research, copy, email, and WhatsApp.
- Work moves in lots of 25: research handles N, copy handles N-1, and senders handle approved N-2 records.
- Never assign two agents to the same row, queue record, workflow, or external destination.
- Repository contracts are authoritative. Live operational state belongs in `WIS · Operaciones de Agentes`.
- Existing conversations are reference-only. Do not archive, duplicate, or message them unless the user requests it.

## Commercial data invariant

`Distribuidoras_300` keeps exactly these 12 columns, in this order:

`Rubro`, `Empresa`, `Ubicación`, `WhatsApp`, `Web`, `Email`, `Rating`, `Reseñas analizadas`, `Problemas`, `ANALISIS NEGOCIO`, `Mensaje WhatsApp`, `Mensaje Email`.

- Do not add operational columns to commercial Sheets.
- Research 300 Argentine distributors first, then 300 logistics companies across LATAM.
- Exclude large corporations and prefer medium or small companies with real operating signals.
- Analyze only 1–3 star reviews and record `analizadas/total accesible`.
- Never guess contacts, review counts, problems, consent, or completion.

## Outreach gates

The message lifecycle is separate from the agent task lifecycle:

`NUEVO → RESEARCH_EN_CURSO → RESEARCH_VALIDADO → BORRADOR → QA → ESPERANDO_APROBACION → APROBADO → EN_COLA → ENVIADO → RESPONDIDO/CERRADO`

Alternates: `BLOQUEADO`, `REBOTADO`, `OPTOUT`, `OUTCOME_UNKNOWN`, and `DESCARTADO`.

- Every external send requires independent QA and an unexpired batch approval covering the exact channel, version, sequence, and recipient count.
- Idempotency key: `prospect_key + campaign_id + channel + sequence`. Before every enqueue, rebuild the key index from `Outreach_Queue` and provider reconciliation; an in-memory-only index is insufficient.
- A prospect cannot receive email and WhatsApp simultaneously. Email is first.
- WhatsApp requires verified opt-in. A number published on Maps or a website is not consent. Outside 24 hours, use only an approved template.
- A timeout or ambiguous provider result becomes `OUTCOME_UNKNOWN`; require a durable `RECONCILED` event with evidence before retrying.
- Stop a prospect after response, opt-out, meeting, hard bounce, or uncertain outcome.

## Channel limits

- Email: `Ortu - WIS <ortu@wis-agency.com>`, individual messages only, no CC/BCC, WIS HTML signature without Gravatar, 25/day, 15-minute interval, 09:30–17:30 America/Buenos_Aires, at most follow-ups on days 3 and 7 when approved.
- WhatsApp: WIS Kapso-MundoVera workflows only, 10/day, 15-minute interval, at most one approved follow-up.
- Never touch DUGAS or QH workflows.
- Pause the affected lot/channel on authentication failure, spam complaint, or hard-bounce rate above 2%.

## Copy contract

- Use `Prospectos potables - A B` as the reference.
- A starts with “Sé que no nos conocemos…”. B starts from the problem and concrete idea.
- Change only one variable per A/B test.
- Use an Argentine, close, spontaneous tone; one verifiable problem; company once without full legal name; no address.
- Do not use “En WIS armamos automatizaciones”, repeat AI claims, use opening question marks, or reproduce accusations.
- Offer a prototype, state that the idea is delivered even without a later engagement, and close with two concrete times.
- The sender adds the signature after approval; the copy agent does not.

## Human approval gates

Stop in `WAITING_APPROVAL` before:

- sending any email or WhatsApp;
- activating/changing schedules, n8n workflows, webhooks, or production flags;
- deploying a service;
- destructive production changes, credentials/permissions, or live side-effect tests.

Research, drafting, read-only audits, local simulations, and explicitly requested operations-Sheet writes are allowed.

## Safety, Git, and QA

- Never store credentials, cookies, tokens, browser state, QR codes, or secret-bearing logs in Git, Sheets, handoffs, or chat.
- Code tasks use isolated `codex/<role>-<task_id>` worktrees.
- Preserve retired LinkedIn, X, content, web, and general automation code unchanged for later migration; it is not active in this pipeline.
- Prefix shell commands with `rtk`.
- Run `rtk npm test` after changing contracts or orchestration.
- The owner tests first; `qa-ops` reviews independently and never silently patches reviewed work.

## Task lifecycle

Agent tasks use only `BACKLOG`, `READY`, `IN_PROGRESS`, `REVIEW`, `WAITING_APPROVAL`, `DONE`, `BLOCKED`, and `CANCELLED`.

Only `wis-orchestrator` assigns owners or changes task lifecycle state. A human decides external side effects.
