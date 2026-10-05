import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { approvalGate, emailApprovalAllowed } from "./server.mjs";
import { commercialDataRow, qaRecordsFromApprovals } from "./sheets-live.mjs";

const message="Asunto: Prueba\n\nMensaje aprobado";
const messageHash=createHash("sha256").update(message,"utf8").digest("hex");
const approval={
  approvalId:"APR-LOG-CHILE-B002-EMAIL-001",
  decision:"APPROVED",
  expiresAt:"2099-01-01T00:00:00.000Z",
  campaignId:"logisticas-latam-chile",
  batchId:"CMD-1790604074153-153e3663-B002",
  channels:["EMAIL"],
  messageVersions:["A2 · humano"],
  sequences:[1],
  prospectRows:[1],
  prospectKeys:["cl-silo-logistica-casablanca"],
  recipientLimit:1,
  sourceSheet:"Logisticas_LATAM",
  qa:{status:"PASSED",reviewer:"qa-ops",independent:true,messageHashes:{EMAIL:{"cl-silo-logistica-casablanca":messageHash}}}
};

test("logistics uses logical rows without overwriting the header",()=>{
  assert.equal(commercialDataRow("Logisticas_LATAM",1),2);
  assert.equal(commercialDataRow("Distribuidoras_300",2),2);
});

test("approved A2 draft becomes independent QA only when its hash matches",()=>{
  const qa=qaRecordsFromApprovals([approval],[{draft_key:"cl-silo-logistica-casablanca:EMAIL",message,updated_by:"outreach-copy"}]);
  assert.equal(qa.length,1);
  assert.equal(qa[0].status,"PASSED");
  assert.equal(qa[0].author,"outreach-copy");
  assert.notEqual(qa[0].author,qa[0].reviewer);
});

test("approval gate binds campaign, batch, row, hash and durable queue",()=>{
  const prospect={sourceSheet:"Logisticas_LATAM",rowNumber:1,prospectKey:"cl-silo-logistica-casablanca",phase:"outreach"};
  const qa=qaRecordsFromApprovals([approval],[{draft_key:"cl-silo-logistica-casablanca:EMAIL",message,updated_by:"outreach-copy"}]);
  const gate=approvalGate({qa,approvals:[approval],outreachQueue:[],providerReconciliationLoaded:true},prospect,"EMAIL");
  assert.equal(gate.eligible,true);
  assert.equal(gate.approvalId,approval.approvalId);
  assert.equal(gate.approvedMessageHash,messageHash);
});

test("Brevo allowlist is exact",()=>{
  process.env.WIS_EMAIL_ALLOWED_APPROVAL_IDS="APR-LOG-CHILE-B002-EMAIL-001";
  assert.equal(emailApprovalAllowed("APR-LOG-CHILE-B002-EMAIL-001"),true);
  assert.equal(emailApprovalAllowed("APR-OTHER"),false);
});
