import test from "node:test";
import assert from "node:assert/strict";
import { acquireSendLocks, approvalGate, assertMutationRequest, channelHealth, channelLimitGate, dashboardAuthorized, explicitE164, normalizeResearchRequest, prospectStopGate, whatsappOptInGate, whatsappQuery } from "../../ops/reports/web/wis-operations-dashboard/server.mjs";

const prospect={rowNumber:42};
const approvedBodyHash="52ad4a85f158f776d1385ac66f4536ff32c4020a5153847566c29bb89d51d7fa";
const qa={rowNumber:42,status:"PASSED",reviewer:"qa-ops",author:"outreach-copy",batchId:"LOT-002",messageVersion:"B-v1",prospectKey:"prospect-42",messageHashes:{EMAIL:approvedBodyHash}};
const approval={
  approvalId:"APR-002",campaignId:"WIS-ARG-001",batchId:"LOT-002",decision:"APPROVED",
  expiresAt:"2099-01-01T00:00:00.000Z",channels:["EMAIL"],messageVersions:["B-v1"],
  sequences:[1],prospectRows:[42],recipientLimit:1
};

test("normaliza únicamente teléfonos internacionales explícitos",()=>{
  assert.equal(explicitE164("+54 9 11 3003-5679 (línea WIS)"),"+5491130035679");
  assert.equal(explicitE164("11 3003-5679 (publicado como WhatsApp)"),"");
});

test("bloquea envío sin QA independiente",()=>{
  assert.deepEqual(approvalGate({},prospect,"EMAIL"),{eligible:false,reason:"INDEPENDENT_QA_REQUIRED"});
  assert.equal(approvalGate({qa:[{...qa,reviewer:"outreach-copy"}]},prospect,"EMAIL").reason,"INDEPENDENT_QA_REQUIRED");
});

test("exige aprobación exacta y snapshots durables",()=>{
  assert.equal(approvalGate({qa:[qa]},prospect,"EMAIL").reason,"BATCH_APPROVAL_REQUIRED");
  assert.equal(approvalGate({qa:[qa],approvals:[approval]},prospect,"EMAIL").reason,"DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED");
});

test("construye la clave canónica y bloquea duplicados",()=>{
  const snapshot={qa:[qa],approvals:[approval],providerReconciliationLoaded:true,outreachQueue:[]};
  const result=approvalGate(snapshot,prospect,"EMAIL");
  assert.equal(result.eligible,true);
  assert.equal(result.idempotencyKey,"prospect-42|WIS-ARG-001|EMAIL|1");
  snapshot.outreachQueue=[{idempotencyKey:result.idempotencyKey,status:"ENVIADO"}];
  assert.equal(approvalGate(snapshot,prospect,"EMAIL").reason,"DUPLICATE_IDEMPOTENCY_KEY");
});

test("exige un alcance exacto y consumible de aprobación",()=>{
  const tooBroad={...approval,recipientLimit:1,prospectRows:[42,43]};
  const snapshot={qa:[qa],approvals:[tooBroad],providerReconciliationLoaded:true,outreachQueue:[]};
  assert.equal(approvalGate(snapshot,prospect,"EMAIL").reason,"BATCH_APPROVAL_REQUIRED");
  const stopped={qa:[qa],approvals:[approval],providerReconciliationLoaded:true,outreachQueue:[{prospectKey:"prospect-42",status:"OPTOUT"}]};
  assert.equal(approvalGate(stopped,prospect,"EMAIL").reason,"PROSPECT_STOPPED");
});

test("WhatsApp acepta únicamente opt-in inbound durable y reconciliado",()=>{
  const waProspect={rowNumber:42,whatsappE164:"+5491100000000"};
  const now=new Date("2026-09-27T14:00:00.000Z");
  const snapshot={qa:[qa],optIns:[{verified:true,reconciled:true,direction:"INBOUND",eventType:"OPT_IN",prospectKey:"prospect-42",phoneE164:"+5491100000000",providerEventId:"wamid-123456",source:"WHATSAPP_INBOUND",scope:"WIS commercial follow-up",recordedAt:"2026-09-27T13:00:00.000Z"}]};
  assert.equal(whatsappOptInGate(snapshot,waProspect,now).eligible,true);
  snapshot.optIns[0].reconciled=false;
  assert.equal(whatsappOptInGate(snapshot,waProspect,now).reason,"DURABLE_OPTIN_REQUIRED");
});

test("reserva de envío es atómica dentro del proceso",()=>{
  const release=acquireSendLocks(["message:key","channel:EMAIL"]);
  assert.equal(typeof release,"function");
  assert.equal(acquireSendLocks(["message:other","channel:EMAIL"]),null);
  release();
  const next=acquireSendLocks(["message:other","channel:EMAIL"]);
  assert.equal(typeof next,"function");
  next();
});

test("la salud del canal exige identidad, firma y pausa levantada",()=>{
  const names=["WIS_EMAIL_WEBHOOK_URL","WIS_EMAIL_WEBHOOK_TOKEN","WIS_EMAIL_OUTBOUND_ENABLED","WIS_EMAIL_SIGNATURE_HTML","WIS_WHATSAPP_WEBHOOK_URL","WIS_WHATSAPP_WEBHOOK_TOKEN","WIS_WHATSAPP_OUTBOUND_ENABLED"];
  const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  Object.assign(process.env,{WIS_EMAIL_WEBHOOK_URL:"https://example.test/email",WIS_EMAIL_WEBHOOK_TOKEN:"secret",WIS_EMAIL_OUTBOUND_ENABLED:"true",WIS_EMAIL_SIGNATURE_HTML:"<p>Firma WIS</p>",WIS_WHATSAPP_WEBHOOK_URL:"https://example.test/wa",WIS_WHATSAPP_WEBHOOK_TOKEN:"secret",WIS_WHATSAPP_OUTBOUND_ENABLED:"true"});
  try {
    const health=channelHealth({email:{aliasVerified:true,defaultSender:true,signatureApproved:true},whatsapp:{identityVerified:true,sessionConnected:true,outboundPaused:true}});
    assert.equal(health.email.canSend,true);
    assert.equal(health.whatsapp.canSend,false);
  } finally {
    for(const name of names) previous[name]===undefined?delete process.env[name]:process.env[name]=previous[name];
  }
});

test("convierte pedidos de research en parámetros seguros y acotados",()=>{
  const request=normalizeResearchRequest({prompt:"Buscame 30 distribuidoras de bebidas en Córdoba con análisis de reseñas"});
  assert.equal(request.quantity,30);
  assert.equal(request.businessType,"distribuidoras");
  assert.equal(request.industry,"Bebidas");
  assert.equal(request.location,"Córdoba");
  assert.equal(request.reviews,"1-3");
  assert.match(request.reviewRule,/1, 2 y 3/);
  assert.throws(()=>normalizeResearchRequest({prompt:"buscame empresas"}),/RESEARCH_INDUSTRY_REQUIRED/);
});

test("la consola desplegada exige credenciales con contraseña hasheada",()=>{
  const names=["WIS_REQUIRE_AUTH","WIS_DASHBOARD_USERNAME","WIS_DASHBOARD_PASSWORD_SHA256"];
  const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  Object.assign(process.env,{WIS_REQUIRE_AUTH:"true",WIS_DASHBOARD_USERNAME:"ortu",WIS_DASHBOARD_PASSWORD_SHA256:"19899365d5dd42bd5d7884b38041f9381f960b2e1a9fe80899a1175096d9dc02"});
  try {
    const good=Buffer.from("ortu:wis-seguro").toString("base64");
    const bad=Buffer.from("ortu:incorrecta").toString("base64");
    assert.equal(dashboardAuthorized({headers:{authorization:`Basic ${good}`}}),true);
    assert.equal(dashboardAuthorized({headers:{authorization:`Basic ${bad}`}}),false);
    assert.equal(dashboardAuthorized({headers:{}}),false);
  } finally {
    for(const name of names) previous[name]===undefined?delete process.env[name]:process.env[name]=previous[name];
  }
});

test("las mutaciones remotas requieren habilitación y origen exacto",()=>{
  const previous=process.env.WIS_ALLOW_REMOTE_MUTATIONS;
  const request={
    socket:{remoteAddress:"10.0.0.42"},
    headers:{origin:"https://ops.wis-agency.com",host:"internal:4174","x-forwarded-host":"ops.wis-agency.com","x-forwarded-proto":"https","sec-fetch-site":"same-origin"}
  };
  try {
    delete process.env.WIS_ALLOW_REMOTE_MUTATIONS;
    assert.throws(()=>assertMutationRequest(request),/REMOTE_MUTATIONS_DISABLED/);
    process.env.WIS_ALLOW_REMOTE_MUTATIONS="true";
    assert.doesNotThrow(()=>assertMutationRequest(request));
    assert.throws(()=>assertMutationRequest({...request,headers:{...request.headers,origin:"https://evil.example"}}),/ORIGIN_BLOCKED/);
  } finally {
    previous===undefined?delete process.env.WIS_ALLOW_REMOTE_MUTATIONS:process.env.WIS_ALLOW_REMOTE_MUTATIONS=previous;
  }
});

test("aplica cupo, cadencia y horario de email en Buenos Aires",()=>{
  const now=new Date("2026-09-28T13:00:00.000Z");
  assert.equal(channelLimitGate([],"EMAIL",now).eligible,true);
  const recent=[{channel:"EMAIL",eventType:"SENT",timestamp:"2026-09-28T12:50:00.000Z"}];
  assert.equal(channelLimitGate(recent,"EMAIL",now).reason,"MINIMUM_INTERVAL_NOT_REACHED");
  const outside=new Date("2026-09-28T11:00:00.000Z");
  assert.equal(channelLimitGate([],"EMAIL",outside).reason,"EMAIL_WINDOW_CLOSED");
});

test("detiene respuestas, bajas y canales simultáneos",()=>{
  assert.equal(prospectStopGate([{rowNumber:42,source:"DASHBOARD",channel:"EMAIL",eventType:"RESPONDIDO"}],prospect,"EMAIL").reason,"PROSPECT_STOPPED");
  assert.equal(prospectStopGate([{rowNumber:42,source:"DASHBOARD",channel:"EMAIL",eventType:"SEND_ATTEMPT"}],prospect,"WHATSAPP").reason,"SIMULTANEOUS_CHANNEL_BLOCKED");
});

test("acota los filtros enviados a la bandeja de WhatsApp",()=>{
  const query=whatsappQuery({q:"  distribuidora norte  ",limit:"999",offset:"-4",conversation_id:"chat-42",sort:"asc",normal_types:"true"});
  assert.equal(query.get("q"),"distribuidora norte");
  assert.equal(query.get("limit"),"100");
  assert.equal(query.get("offset"),"0");
  assert.equal(query.get("conversation_id"),"chat-42");
  assert.equal(query.get("sort"),"asc");
  assert.equal(query.get("normal_types"),"true");
});
