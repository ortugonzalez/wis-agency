import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs", "agent-operations");
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const roles = [
  "wis-orchestrator",
  "prospect-research",
  "outreach-copy",
  "email-sender",
  "whatsapp-sender",
  "qa-ops",
];
const statuses = ["BACKLOG", "READY", "IN_PROGRESS", "REVIEW", "WAITING_APPROVAL", "DONE", "BLOCKED", "CANCELLED"];

function styleSheet(sheet, usedRange, headerRange, textColumns = []) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  usedRange.format.font = { name: "Arial", size: 10, color: "#202124" };
  usedRange.format.verticalAlignment = "center";
  headerRange.format = {
    fill: "#E8EAED",
    font: { name: "Arial", size: 10, bold: true, color: "#202124" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#BDC1C6" },
  };
  for (const column of textColumns) sheet.getRange(column).format.wrapText = true;
  usedRange.format.autofitColumns();
  usedRange.format.autofitRows();
}

const backlog = workbook.worksheets.add("Backlog");
const backlogRows = [
  ["task_id", "stream", "título", "prioridad", "owner", "status", "dependencies", "source_thread_ids", "deliverable", "write_scope", "approval_required", "next_action", "updated_at"],
  ["WIS-SYS-001", "Foundation", "Implementar la base multiagente", "P0", "wis-orchestrator", "IN_PROGRESS", "", "01a011c8-321c-7ea1-a899-9997cf861579", "Contratos, baseline, tablero y dry-run", "Repositorio raíz y tablero operativo", "NO", "Completar baseline y QA", new Date("2026-09-26T12:00:00Z")],
  ["WIS-REV-001", "Revenue", "Auditar distribuidoras provisionales", "P0", "prospect-research", "READY", "WIS-SYS-001", "01a011c6-ec79-7d32-b706-b4b73f9abdcb", "Primer lote validado de 25 filas", "Columnas comerciales existentes", "NO", "Preparar lote 1/25", new Date("2026-09-27T12:00:00Z")],
  ["WIS-COPY-001", "Revenue", "Redactar lote canario", "P0", "outreach-copy", "BACKLOG", "WIS-REV-001", "01a0654f-a185-7a43-a068-fcd39852b304", "Variantes A/B para lote validado", "Mensaje WhatsApp y Mensaje Email", "NO", "Esperar research validado", new Date("2026-09-27T12:00:00Z")],
  ["WIS-EMAIL-001", "Outreach", "Preparar canario de 5 emails", "P0", "email-sender", "WAITING_APPROVAL", "WIS-COPY-001", "01a0654f-a185-7a43-a068-fcd39852b304", "Canario validado y sin envíos hasta aprobación", "Outreach_Queue y Outreach_Events", "SI", "Cerrar bloqueos de integración y solicitar aprobación", new Date("2026-09-27T12:00:00Z")],
  ["WIS-WA-001", "Outreach", "Preparar canario de hasta 2 WhatsApp con opt-in", "P0", "whatsapp-sender", "WAITING_APPROVAL", "WIS-COPY-001", "01a011c8-647b-71c1-8da8-d56f3d6412ae", "Canario elegible sólo con opt-in", "Outreach_Queue y Outreach_Events", "SI", "Validar plantilla, 24h e idempotencia", new Date("2026-09-27T12:00:00Z")],
  ["WIS-REV-002", "Revenue", "Completar 300 distribuidoras argentinas", "P0", "prospect-research", "BACKLOG", "WIS-REV-001", "01a011c6-ec79-7d32-b706-b4b73f9abdcb", "300 empresas únicas con QA", "Columnas comerciales existentes", "NO", "Procesar lotes de 25", new Date("2026-09-27T12:00:00Z")],
  ["WIS-LOG-001", "Revenue", "Completar 300 logísticas de Latinoamérica", "P1", "prospect-research", "BACKLOG", "WIS-REV-002", "01a011c6-ec79-7d32-b706-b4b73f9abdcb", "300 logísticas únicas con QA", "Planilla comercial autorizada", "NO", "Comenzar después de distribuidoras", new Date("2026-09-27T12:00:00Z")],
];
backlog.getRange(`A1:M${backlogRows.length}`).values = backlogRows;
backlog.getRange("M2:M2000").format.numberFormat = "yyyy-mm-dd hh:mm";
backlog.getRange(`D2:D${backlogRows.length}`).dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
backlog.getRange(`E2:E${backlogRows.length}`).dataValidation = { rule: { type: "list", values: roles } };
backlog.getRange(`F2:F${backlogRows.length}`).dataValidation = { rule: { type: "list", values: statuses } };
backlog.getRange(`K2:K${backlogRows.length}`).dataValidation = { rule: { type: "list", values: ["NO", "SI"] } };
backlog.tables.add(`A1:M${backlogRows.length}`, true, "BacklogTable");
styleSheet(backlog, backlog.getRange(`A1:M${backlogRows.length}`), backlog.getRange("A1:M1"), [`C2:C${backlogRows.length}`, `H2:J${backlogRows.length}`, `L2:L${backlogRows.length}`]);
backlog.getRange("A:A").format.columnWidth = 16;
backlog.getRange("C:C").format.columnWidth = 32;
backlog.getRange("H:J").format.columnWidth = 28;
backlog.getRange("L:L").format.columnWidth = 28;

const runs = workbook.worksheets.add("Runs");
const runRows = [
  ["run_id", "task_id", "agent", "status", "started_at", "finished_at", "branch", "worktree", "evidence", "tests", "blocker"],
  ["RUN-WIS-SYS-001-001", "WIS-SYS-001", "wis-orchestrator", "IN_PROGRESS", new Date("2026-09-26T12:00:00Z"), null, "master", "Repositorio raíz", "Inventario y contratos creados", "Validación de agentes y dry-run", ""],
];
runs.getRange(`A1:K${runRows.length}`).values = runRows;
runs.getRange(`C2:C${runRows.length}`).dataValidation = { rule: { type: "list", values: roles } };
runs.getRange(`D2:D${runRows.length}`).dataValidation = { rule: { type: "list", values: ["IN_PROGRESS", "REVIEW", "WAITING_APPROVAL", "DONE", "BLOCKED", "CANCELLED"] } };
runs.getRange("E2:F2000").format.numberFormat = "yyyy-mm-dd hh:mm";
runs.tables.add(`A1:K${runRows.length}`, true, "RunsTable");
styleSheet(runs, runs.getRange(`A1:K${runRows.length}`), runs.getRange("A1:K1"), [`I2:K${runRows.length}`]);
runs.getRange("A:D").format.columnWidth = 20;
runs.getRange("G:H").format.columnWidth = 24;
runs.getRange("I:K").format.columnWidth = 30;

const approvals = workbook.worksheets.add("Approvals");
const approvalRows = [["approval_id", "task_id", "action", "impact", "evidence", "requested_at", "decision", "decided_at", "decided_by"]];
approvals.getRange("A1:I1").values = approvalRows;
approvals.getRange("A2:I2").values = [["", "", "", "", "", null, "", null, ""]];
approvals.getRange("G2").dataValidation = { rule: { type: "list", values: ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] } };
approvals.getRange("F2:H2000").format.numberFormat = "yyyy-mm-dd hh:mm";
approvals.tables.add("A1:I2", true, "ApprovalsTable");
styleSheet(approvals, approvals.getRange("A1:I2"), approvals.getRange("A1:I1"), ["D2:E2"]);
approvals.getRange("A:C").format.columnWidth = 21;
approvals.getRange("D:E").format.columnWidth = 34;
approvals.getRange("F:I").format.columnWidth = 20;

const handoffs = workbook.worksheets.add("Handoffs_Incidents");
const handoffRows = [
  ["record_id", "type", "task_id", "from_agent", "to_agent", "artifact", "evidence_or_issue", "tests_or_recovery", "next_action", "status", "created_at"],
  ["HOF-WIS-SYS-001-001", "HANDOFF", "WIS-SYS-001", "qa-ops", "wis-orchestrator", "docs/BASELINE_INVENTORY.md", "Repositorios anidados y artefactos generados identificados", "Staging selectivo, revisión de secretos y sin gitlinks", "Crear baseline raíz sin modificar repositorios independientes", "DONE", new Date("2026-09-26T12:00:00Z")],
];
handoffs.getRange(`A1:K${handoffRows.length}`).values = handoffRows;
handoffs.getRange(`B2:B${handoffRows.length}`).dataValidation = { rule: { type: "list", values: ["HANDOFF", "INCIDENT"] } };
handoffs.getRange(`D2:E${handoffRows.length}`).dataValidation = { rule: { type: "list", values: roles } };
handoffs.getRange(`J2:J${handoffRows.length}`).dataValidation = { rule: { type: "list", values: statuses } };
handoffs.getRange("K2:K2000").format.numberFormat = "yyyy-mm-dd hh:mm";
handoffs.tables.add(`A1:K${handoffRows.length}`, true, "HandoffsIncidentsTable");
styleSheet(handoffs, handoffs.getRange(`A1:K${handoffRows.length}`), handoffs.getRange("A1:K1"), [`F2:I${handoffRows.length}`]);
handoffs.getRange("A:E").format.columnWidth = 20;
handoffs.getRange("F:I").format.columnWidth = 32;
handoffs.getRange("J:K").format.columnWidth = 20;

const queue = workbook.worksheets.add("Outreach_Queue");
const queueHeaders = [["message_id", "idempotency_key", "prospect_key", "campaign_id", "batch_id", "source_sheet", "source_row", "empresa", "channel", "sequence", "recipient", "message_version", "approval_id", "eligibility", "status", "scheduled_at", "sent_at", "provider_ref", "outcome", "last_error", "attempts", "next_action", "opt_in_verified", "opt_in_source", "opt_in_recorded_at", "within_24h_at_evaluation", "template_id"]];
queue.getRange("A1:AA1").values = queueHeaders;
queue.getRange("A2:AA2").values = [["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", null, null, "", "", "", 0, "", "", "", null, "", ""]];
queue.getRange("I2:I2000").dataValidation = { rule: { type: "list", values: ["EMAIL", "WHATSAPP"] } };
queue.getRange("N2:N2000").dataValidation = { rule: { type: "list", values: ["ELIGIBLE", "BLOCKED", "OPT_IN_REQUIRED", "TEMPLATE_REQUIRED"] } };
queue.getRange("O2:O2000").dataValidation = { rule: { type: "list", values: ["NUEVO", "RESEARCH_EN_CURSO", "RESEARCH_VALIDADO", "BORRADOR", "QA", "ESPERANDO_APROBACION", "APROBADO", "EN_COLA", "ENVIADO", "RESPONDIDO", "CERRADO", "BLOQUEADO", "REBOTADO", "OPTOUT", "OUTCOME_UNKNOWN", "DESCARTADO"] } };
queue.getRange("W2:W2000").dataValidation = { rule: { type: "list", values: ["NO", "SI"] } };
queue.getRange("Z2:Z2000").dataValidation = { rule: { type: "list", values: ["NO", "SI"] } };
queue.getRange("P2:Q2000").format.numberFormat = "yyyy-mm-dd hh:mm";
queue.getRange("Y2:Y2000").format.numberFormat = "yyyy-mm-dd hh:mm";
queue.tables.add("A1:AA2", true, "OutreachQueueTable");
styleSheet(queue, queue.getRange("A1:AA2"), queue.getRange("A1:AA1"), ["H2:H2", "R2:AA2"]);
queue.getRange("A:O").format.columnWidth = 20;
queue.getRange("P:AA").format.columnWidth = 24;

const events = workbook.worksheets.add("Outreach_Events");
const eventHeaders = [["event_id", "message_id", "timestamp", "channel", "from_status", "to_status", "event_type", "provider_ref", "reason", "reconciled", "actor", "evidence"]];
events.getRange("A1:L1").values = eventHeaders;
events.getRange("A2:L2").values = [["", "", null, "", "", "", "", "", "", "", "", ""]];
events.getRange("D2:D2000").dataValidation = { rule: { type: "list", values: ["EMAIL", "WHATSAPP"] } };
events.getRange("G2:G2000").dataValidation = { rule: { type: "list", values: ["OPT_IN_RECORDED", "QUEUED", "ATTEMPTED", "DELIVERED", "REPLIED", "MEETING", "BOUNCED", "OPTOUT", "ERROR", "OUTCOME_UNKNOWN", "RECONCILED", "CLOSED"] } };
events.getRange("J2:J2000").dataValidation = { rule: { type: "list", values: ["NO", "SI"] } };
events.getRange("C2:C2000").format.numberFormat = "yyyy-mm-dd hh:mm";
events.tables.add("A1:L2", true, "OutreachEventsTable");
styleSheet(events, events.getRange("A1:L2"), events.getRange("A1:L1"), ["H2:L2"]);
events.getRange("A:G").format.columnWidth = 20;
events.getRange("H:L").format.columnWidth = 28;

workbook.recalculate();

for (const sheetName of ["Backlog", "Runs", "Approvals", "Handoffs_Incidents", "Outreach_Queue", "Outreach_Events"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const inspection = await workbook.inspect({ kind: "workbook,sheet,table", maxChars: 12000, tableMaxRows: 8, tableMaxCols: 14 });
await fs.writeFile(path.join(outputDir, "inspection.ndjson"), inspection.ndjson, "utf8");

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
await fs.writeFile(path.join(outputDir, "formula-errors.ndjson"), formulaErrors.ndjson, "utf8");

const output = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = path.join(outputDir, "WIS-Operaciones-de-Agentes.xlsx");
await output.save(outputPath);
console.log(outputPath);
