import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { approvalGate, channelLimitGate, emailApprovalAllowed, reconcileBrevoRecipient, sendSnapshotGate, whatsappOptInGate } from "./server.mjs";
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
  recipients:["SILO Logística"],
  recipientEmails:["contacto@silo-logistica.cl"],
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

const prospect={sourceSheet:"Logisticas_LATAM",rowNumber:1,prospectKey:"cl-silo-logistica-casablanca",empresa:"SILO Logística",email:"contacto@silo-logistica.cl",phase:"outreach"};

test("approval gate binds campaign, batch, row, recipient, hash and durable queue",()=>{
  const qa=qaRecordsFromApprovals([approval],[{draft_key:"cl-silo-logistica-casablanca:EMAIL",message,updated_by:"outreach-copy"}]);
  const gate=approvalGate({qa,approvals:[approval],outreachQueue:[],providerReconciliationLoaded:true},prospect,"EMAIL");
  assert.equal(gate.eligible,true);
  assert.equal(gate.approvalId,approval.approvalId);
  assert.equal(gate.approvedMessageHash,messageHash);
});

test("approval gate rejects a changed recipient and a missing provider reconciliation",()=>{
  const qa=qaRecordsFromApprovals([approval],[{draft_key:"cl-silo-logistica-casablanca:EMAIL",message,updated_by:"outreach-copy"}]);
  assert.equal(approvalGate({qa,approvals:[approval],outreachQueue:[],providerReconciliationLoaded:true},{...prospect,email:"attacker@example.com"},"EMAIL").reason,"BATCH_APPROVAL_REQUIRED");
  assert.equal(approvalGate({qa,approvals:[approval],outreachQueue:[],providerReconciliationLoaded:true},{...prospect,prospectKey:"cl-attacker"},"EMAIL").reason,"BATCH_APPROVAL_REQUIRED");
  assert.equal(approvalGate({qa,approvals:[approval],outreachQueue:[],providerReconciliationLoaded:false},prospect,"EMAIL").reason,"DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED");
});

test("approval gate rejects an already durable idempotency key",()=>{
  const qa=qaRecordsFromApprovals([approval],[{draft_key:"cl-silo-logistica-casablanca:EMAIL",message,updated_by:"outreach-copy"}]);
  const idempotencyKey="cl-silo-logistica-casablanca|logisticas-latam-chile|EMAIL|1";
  assert.equal(approvalGate({qa,approvals:[approval],outreachQueue:[{idempotencyKey}],providerReconciliationLoaded:true},prospect,"EMAIL").reason,"DUPLICATE_IDEMPOTENCY_KEY");
});

test("changed copy fails QA hash validation",()=>{
  const qa=qaRecordsFromApprovals([approval],[{draft_key:"cl-silo-logistica-casablanca:EMAIL",message:`${message} editado`,updated_by:"outreach-copy"}]);
  assert.equal(qa[0].status,"FAILED");
});

test("channel cadence and WhatsApp opt-in gates remain closed",()=>{
  const now=new Date("2026-10-05T14:00:00.000Z");
  assert.equal(channelLimitGate([{channel:"EMAIL",eventType:"SENT",timestamp:"2026-10-05T13:50:00.000Z"}],"EMAIL",now).reason,"MINIMUM_INTERVAL_NOT_REACHED");
  assert.equal(whatsappOptInGate({optIns:[]},{prospectKey:"cl-silo-logistica-casablanca",whatsappE164:"+56942948926"},now).reason,"DURABLE_OPTIN_REQUIRED");
});

test("Brevo reconciliation fails closed and detects a provider duplicate",async()=>{
  const originalFetch=globalThis.fetch;
  process.env.BREVO_API_KEY="test";
  try {
    globalThis.fetch=async()=>({ok:true,json:async()=>({events:[{event:"delivered",date:"2026-10-05T12:30:00.000Z"}]})});
    assert.equal((await reconcileBrevoRecipient({email:"contacto@silo-logistica.cl",approvedAt:"2026-10-05T12:20:06.163Z"})).error,"PROVIDER_DUPLICATE_RECIPIENT");
    globalThis.fetch=async()=>({ok:false,json:async()=>({})});
    assert.equal((await reconcileBrevoRecipient({email:"contacto@silo-logistica.cl",approvedAt:"2026-10-05T12:20:06.163Z"})).error,"EMAIL_PROVIDER_RECONCILIATION_FAILED");
  } finally {
    globalThis.fetch=originalFetch;
    delete process.env.BREVO_API_KEY;
  }
});

test("Brevo allowlist is exact",()=>{
  process.env.WIS_EMAIL_ALLOWED_APPROVAL_IDS="APR-LOG-CHILE-B002-EMAIL-001";
  assert.equal(emailApprovalAllowed("APR-LOG-CHILE-B002-EMAIL-001"),true);
  assert.equal(emailApprovalAllowed("APR-OTHER"),false);
});

test("send endpoint source avoids a forced full Sheets refresh",async()=>{
  const source=await (await import("node:fs/promises")).readFile(new URL("./server.mjs",import.meta.url),"utf8");
  const processSendSource=source.slice(source.indexOf("async function processSend"),source.indexOf("async function syncFromProxy"));
  assert.doesNotMatch(processSendSource,/refreshLiveSheets\(true\)/);
  assert.match(processSendSource,/dashboardPayload\(\{refresh:false\}\)/);
  assert.match(processSendSource,/sendSnapshotGate\(sendSnapshot\)/);
});

test("send snapshot gate fails closed for stale, future and invalid timestamps",()=>{
  const now=Date.parse("2026-10-05T15:00:00.000Z");
  assert.equal(sendSnapshotGate({fetchedAt:"2026-10-05T14:59:00.000Z"},now,120).eligible,true);
  assert.equal(sendSnapshotGate({fetchedAt:"2026-10-05T14:57:59.000Z"},now,120).reason,"SEND_SNAPSHOT_STALE");
  assert.equal(sendSnapshotGate({fetchedAt:"2026-10-05T15:00:31.000Z"},now,120).reason,"SEND_SNAPSHOT_STALE");
  assert.equal(sendSnapshotGate({fetchedAt:"invalid"},now,"invalid").reason,"SEND_SNAPSHOT_STALE");
});
