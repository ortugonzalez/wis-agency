import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const publicDir = join(root, "ops", "reports", "web", "wis-operations-dashboard", "out");
const configDir = join(root, "ops", "config");
const runtimeDir = join(root, "ops", "runtime");
const commandsPath = join(runtimeDir, "dashboard-commands.ndjson");
const sheetSnapshotPath = join(runtimeDir, "dashboard-sheet-snapshot.json");
const outreachEventsPath = join(runtimeDir, "dashboard-outreach-events.ndjson");
const statePath = join(configDir, "dashboard-state.json");
const channelVerificationPath = join(configDir, "channel-verification.json");
const port = Number(process.env.WIS_DASHBOARD_PORT || 4174);
const allowedActions = new Set(["CONTINUE_RESEARCH", "RUN_QA", "REFRESH_SNAPSHOT", "PREPARE_DRAFTS"]);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" };
const activeSendLocks = new Set();

await mkdir(runtimeDir, { recursive: true });

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function writeJsonAtomic(path, value) {
  const temporary=`${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`,"utf8");
  await rename(temporary,path);
}

async function readNdjson(path, limit=300) {
  try {
    return (await readFile(path,"utf8")).trim().split("\n").filter(Boolean).map(line=>JSON.parse(line)).slice(-limit).reverse();
  } catch { return []; }
}

async function requestBody(req, max=256_000) {
  let raw="";
  for await (const chunk of req) {
    raw+=chunk;
    if(raw.length>max) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"),{status:413});
  }
  try { return raw?JSON.parse(raw):{}; }
  catch { throw Object.assign(new Error("INVALID_JSON"),{status:400}); }
}

function json(res,status,value) {
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
  res.end(JSON.stringify(value));
}

function hash(value) {
  return createHash("sha256").update(String(value??""),"utf8").digest("hex");
}

function key(value) {
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
}

function isLocalRequest(req) {
  const address=req.socket.remoteAddress||"";
  return address==="127.0.0.1"||address==="::1"||address==="::ffff:127.0.0.1";
}

function assertLocalMutation(req) {
  if(!isLocalRequest(req)) throw Object.assign(new Error("LOCAL_ONLY"),{status:403});
  const origin=req.headers.origin;
  if(origin && !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw Object.assign(new Error("ORIGIN_BLOCKED"),{status:403});
}

function normalizeUrl(value) {
  const raw=String(value||"").trim();
  if(!raw) return "";
  try { return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).href; } catch { return raw; }
}

function explicitE164(value) {
  const beforeNote=String(value||"").split("(")[0].trim();
  if(!beforeNote.startsWith("+")) return "";
  const normalized=`+${beforeNote.replace(/\D/g,"")}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized)?normalized:"";
}

function normalizeProspect(row,index) {
  return {
    rowNumber:Number(row.rowNumber||index+2),
    rubro:String(row.rubro||"").trim(),
    empresa:String(row.empresa||"").trim(),
    ubicacion:String(row.ubicacion||"").trim(),
    whatsapp:String(row.whatsapp||"").trim(),
    whatsappE164:explicitE164(row.whatsapp),
    web:normalizeUrl(row.web),
    email:String(row.email||"").trim().toLowerCase(),
    rating:String(row.rating||"").trim(),
    reviewsAnalyzed:String(row.reviewsAnalyzed||"").trim(),
    problems:String(row.problems||"").trim(),
    analysis:String(row.analysis||"").trim(),
    whatsappMessage:String(row.whatsappMessage||"").trim(),
    emailMessage:String(row.emailMessage||"").trim(),
    lastStatus:String(row.lastStatus||"").trim()
  };
}

function candidateReady(row) {
  return /^\s*\d+\s*\/\s*\d+\s*$/.test(row.reviewsAnalyzed)&&Boolean(row.analysis&&row.problems&&(row.emailMessage||row.whatsappMessage));
}

function acquireSendLocks(lockKeys) {
  const keys=[...new Set(lockKeys)].sort();
  if(keys.some(lockKey=>activeSendLocks.has(lockKey))) return null;
  keys.forEach(lockKey=>activeSendLocks.add(lockKey));
  return ()=>keys.forEach(lockKey=>activeSendLocks.delete(lockKey));
}

function approvalGate(snapshot, prospect, channel) {
  const qa=(snapshot.qa||[]).find(row=>Number(row.rowNumber)===prospect.rowNumber);
  if(!qa||qa.status!=="PASSED"||!qa.reviewer||!qa.author||key(qa.reviewer)===key(qa.author)) {
    return {eligible:false,reason:"INDEPENDENT_QA_REQUIRED"};
  }
  const now=Date.now();
  const approval=(snapshot.approvals||[]).find(row=>
    row.decision==="APPROVED" &&
    Boolean(row.approvalId)&&Boolean(row.campaignId) &&
    row.batchId===qa.batchId &&
    Array.isArray(row.channels)&&row.channels.includes(channel) &&
    Array.isArray(row.messageVersions)&&row.messageVersions.includes(qa.messageVersion) &&
    Array.isArray(row.sequences)&&row.sequences.includes(1) &&
    Array.isArray(row.prospectRows)&&row.prospectRows.includes(prospect.rowNumber) &&
    Number.isInteger(Number(row.recipientLimit))&&Number(row.recipientLimit)>0 &&
    row.prospectRows.length===Number(row.recipientLimit) &&
    new Set(row.prospectRows.map(Number)).size===Number(row.recipientLimit) &&
    Number.isFinite(Date.parse(row.expiresAt))&&Date.parse(row.expiresAt)>now
  );
  if(!approval) return {eligible:false,reason:"BATCH_APPROVAL_REQUIRED"};
  if(!snapshot.providerReconciliationLoaded||!Array.isArray(snapshot.outreachQueue)) {
    return {eligible:false,reason:"DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED"};
  }
  const approvedMessageHash=qa.messageHashes?.[channel];
  if(!/^[a-f0-9]{64}$/.test(approvedMessageHash||"")) {
    return {eligible:false,reason:"APPROVED_MESSAGE_HASH_REQUIRED"};
  }
  const prospectKey=qa.prospectKey||`distribuidoras-300-row-${prospect.rowNumber}`;
  const idempotencyKey=`${prospectKey}|${approval.campaignId}|${channel}|1`;
  const stopped=snapshot.outreachQueue.some(row=>(row.prospectKey===prospectKey||Number(row.rowNumber)===prospect.rowNumber)&&
    /RESPONDIDO|REPLY|MEETING|REUNION|OPTOUT|REBOTADO|HARD_BOUNCE|OUTCOME_UNKNOWN|CERRADO/i.test(row.eventType||row.status||""));
  if(stopped) return {eligible:false,reason:"PROSPECT_STOPPED",idempotencyKey};
  const duplicate=snapshot.outreachQueue.some(row=>row.idempotencyKey===idempotencyKey);
  if(duplicate) return {eligible:false,reason:"DUPLICATE_IDEMPOTENCY_KEY",idempotencyKey};
  const consumedProspects=new Set(snapshot.outreachQueue.filter(row=>row.approvalId===approval.approvalId&&
    /EN_COLA|SEND_ATTEMPT|ENVIADO|SENT|DELIVERED|RESPONDIDO|OPTOUT|REBOTADO|HARD_BOUNCE|OUTCOME_UNKNOWN|CERRADO/i.test(row.eventType||row.status||""))
    .map(row=>row.prospectKey||row.rowNumber||row.idempotencyKey));
  if(consumedProspects.size>=Number(approval.recipientLimit)) return {eligible:false,reason:"APPROVAL_RECIPIENT_LIMIT_REACHED",idempotencyKey};
  return {
    eligible:true,
    reason:"ELIGIBLE",
    approvalId:approval.approvalId,
    campaignId:approval.campaignId,
    batchId:approval.batchId,
    messageVersion:qa.messageVersion,
    approvedMessageHash,
    idempotencyKey
  };
}

function whatsappOptInGate(snapshot, prospect, now=new Date()) {
  const qa=(snapshot.qa||[]).find(row=>Number(row.rowNumber)===prospect.rowNumber);
  const prospectKey=qa?.prospectKey||`distribuidoras-300-row-${prospect.rowNumber}`;
  const optIn=(snapshot.optIns||[]).find(row=>
    row.verified===true&&row.reconciled===true&&row.direction==="INBOUND"&&row.eventType==="OPT_IN"&&
    row.prospectKey===prospectKey&&row.phoneE164===prospect.whatsappE164&&
    typeof row.providerEventId==="string"&&row.providerEventId.length>=8&&
    typeof row.source==="string"&&row.source.length>=3&&typeof row.scope==="string"&&row.scope.length>=3&&
    Number.isFinite(Date.parse(row.recordedAt))
  );
  if(!optIn) return {eligible:false,reason:"DURABLE_OPTIN_REQUIRED"};
  const age=now.getTime()-Date.parse(optIn.recordedAt);
  if(age<0||age>24*60*60*1000) return {eligible:false,reason:"SERVICE_WINDOW_EXPIRED"};
  return {eligible:true,reason:"ELIGIBLE",providerEventId:optIn.providerEventId,recordedAt:optIn.recordedAt,source:optIn.source,scope:optIn.scope};
}

function isSuccessfulSend(event) {
  return /^(?:SENT|ENVIADO|DELIVERED|LEGACY_SEND_IMPORTED|SEND_CONFIRMED)$/i.test(event.eventType||event.status||"");
}

function buenosAiresParts(value) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date(value)).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
}

function channelLimitGate(events, channel, now=new Date()) {
  const sent=(events||[]).filter(row=>row.channel===channel&&isSuccessfulSend(row)&&Number.isFinite(Date.parse(row.timestamp)));
  const current=buenosAiresParts(now);
  const sameDay=sent.filter(row=>{
    const parts=buenosAiresParts(row.timestamp);
    return parts.year===current.year&&parts.month===current.month&&parts.day===current.day;
  });
  const cap=channel==="EMAIL"?25:10;
  if(sameDay.length>=cap) return {eligible:false,reason:"DAILY_LIMIT_REACHED"};
  const last=sent.map(row=>Date.parse(row.timestamp)).sort((a,b)=>b-a)[0];
  if(last&&now.getTime()-last<15*60*1000) return {eligible:false,reason:"MINIMUM_INTERVAL_NOT_REACHED"};
  if(channel==="EMAIL") {
    const minutes=Number(current.hour)*60+Number(current.minute);
    if(minutes<9*60+30||minutes>17*60+30) return {eligible:false,reason:"EMAIL_WINDOW_CLOSED"};
  }
  return {eligible:true,reason:"ELIGIBLE"};
}

function eventMatchesProspect(event,prospect) {
  return (event.source==="DASHBOARD"&&Number(event.rowNumber)===prospect.rowNumber)||
    (prospect.email&&key(event.recipient)===key(prospect.email))||
    (event.empresa&&key(event.empresa)===key(prospect.empresa));
}

function prospectStopGate(events,prospect,channel) {
  const related=(events||[]).filter(event=>eventMatchesProspect(event,prospect));
  const stopped=related.find(event=>/RESPONDIDO|REPLY|MEETING|REUNION|OPTOUT|HARD_BOUNCE|OUTCOME_UNKNOWN|CERRADO/i.test(event.eventType||event.status||""));
  if(stopped) return {eligible:false,reason:"PROSPECT_STOPPED"};
  const activeOther=related.find(event=>event.channel&&event.channel!==channel&&/SEND_ATTEMPT|EN_COLA/i.test(event.eventType||event.status||""));
  if(activeOther) return {eligible:false,reason:"SIMULTANEOUS_CHANNEL_BLOCKED"};
  return {eligible:true,reason:"ELIGIBLE"};
}

function channelHealth(verification={}) {
  const emailConfigured=Boolean(process.env.WIS_EMAIL_WEBHOOK_URL&&process.env.WIS_EMAIL_WEBHOOK_TOKEN);
  const waConfigured=Boolean(process.env.WIS_WHATSAPP_WEBHOOK_URL&&process.env.WIS_WHATSAPP_WEBHOOK_TOKEN);
  const emailConnected=verification.email?.aliasVerified===true&&verification.email?.defaultSender===true;
  const whatsappConnected=verification.whatsapp?.identityVerified===true&&verification.whatsapp?.sessionConnected===true;
  const signatureApproved=verification.email?.signatureApproved===true&&Boolean(process.env.WIS_EMAIL_SIGNATURE_HTML);
  return {
    email:{
      provider:"Gmail / Brevo",
      account:"Ortu - WIS <ortu@wis-agency.com>",
      canSend:emailConfigured&&emailConnected&&signatureApproved&&process.env.WIS_EMAIL_OUTBOUND_ENABLED==="true",
      configured:emailConfigured,
      connected:emailConnected,
      detail:!emailConnected?"Falta verificar el alias y el remitente predeterminado.":!signatureApproved?"Alias verificado; falta aprobar y cargar la firma HTML WIS.":!emailConfigured?"Alias y firma verificados; falta el webhook exclusivo de envío.":"El adaptador está conectado y permanece pausado hasta habilitar el canal."
    },
    whatsapp:{
      provider:"Workflow WIS · 5679",
      account:"línea WIS · •••• 5679",
      canSend:waConfigured&&whatsappConnected&&verification.whatsapp?.outboundPaused===false&&process.env.WIS_WHATSAPP_OUTBOUND_ENABLED==="true",
      configured:waConfigured,
      connected:whatsappConnected,
      detail:!whatsappConnected?"Falta verificar la identidad y la sesión exclusiva de la línea 5679.":verification.whatsapp?.outboundPaused!==false?"Identidad y sesión 5679 verificadas; la salida continúa pausada.":!waConfigured?"La línea está verificada; falta conectar el workflow WIS exclusivo.":"El workflow WIS está conectado y permanece bloqueado hasta habilitar el canal."
    }
  };
}

async function dashboardPayload() {
  const [snapshot,state,localEvents,verification]=await Promise.all([
    readJson(sheetSnapshotPath,{fetchedAt:null,source:"NONE",prospects:[],events:[]}),
    readJson(statePath,{}),
    readNdjson(outreachEventsPath,500),
    readJson(channelVerificationPath,{})
  ]);
  const prospects=(snapshot.prospects||[]).map(normalizeProspect);
  const events=[...localEvents,...(snapshot.events||[])].sort((a,b)=>String(b.timestamp||"").localeCompare(String(a.timestamp||"")));
  const sentEvents=events.filter(row=>isSuccessfulSend(row)||/RESPONDIDO/i.test(row.eventType||row.status||""));
  const contactedRows=new Set();
  for(const prospect of prospects) {
    const matched=sentEvents.some(event=>(event.source==="DASHBOARD"&&Number(event.rowNumber)===prospect.rowNumber) ||
      (prospect.email&&key(event.recipient)===key(prospect.email)) || (event.empresa&&key(event.empresa)===key(prospect.empresa)));
    if(matched) { prospect.lastStatus="ENVIADO"; contactedRows.add(prospect.rowNumber); }
  }
  const emailSent=events.filter(row=>row.channel==="EMAIL"&&isSuccessfulSend(row)).length;
  const whatsappSent=events.filter(row=>row.channel==="WHATSAPP"&&isSuccessfulSend(row)).length;
  const replies=events.filter(row=>/REPLY|RESPONDIDO|POSITIVE/i.test(row.eventType||row.status||"")).length;
  const health=channelHealth(verification);
  for(const prospect of prospects) {
    prospect.eligibility={
      EMAIL:approvalGate(snapshot,prospect,"EMAIL"),
      WHATSAPP:approvalGate(snapshot,prospect,"WHATSAPP")
    };
    prospect.whatsappOptIn=whatsappOptInGate(snapshot,prospect);
  }
  return {
    generatedAt:new Date().toISOString(),
    prospects,
    events:events.slice(0,500),
    stats:{
      prospects:prospects.length,
      bothChannels:prospects.filter(row=>row.email&&row.whatsapp).length,
      ready:prospects.filter(candidateReady).length,
      contacted:contactedRows.size,
      events:events.length,
      emailSent,
      whatsappSent,
      replies
    },
    channels:health,
    governance:{
      qaPassed:(snapshot.qa||[]).filter(row=>row.status==="PASSED").length,
      activeApprovals:(snapshot.approvals||[]).filter(row=>row.decision==="APPROVED"&&Date.parse(row.expiresAt)>Date.now()).length,
      providerReconciliationLoaded:snapshot.providerReconciliationLoaded===true
    },
    sync:{
      status:snapshot.source==="GOOGLE_SHEETS_LIVE"?"LIVE":snapshot.fetchedAt?"SNAPSHOT":"ERROR",
      fetchedAt:snapshot.fetchedAt,
      source:snapshot.source||"NONE",
      detail:snapshot.fetchedAt?`${prospects.length} filas leídas de Distribuidoras_300.`:"Todavía no existe un snapshot de Google Sheets."
    }
  };
}

async function appendEvent(event) {
  const complete={eventId:`EVT-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),...event};
  await appendFile(outreachEventsPath,`${JSON.stringify(complete)}\n`,"utf8");
  return complete;
}

async function postJson(url,payload,headers={}) {
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(25_000)});
  const text=await response.text();
  let parsed={};
  try { parsed=text?JSON.parse(text):{}; } catch { parsed={raw:text.slice(0,500)}; }
  return {ok:response.ok,status:response.status,body:parsed};
}

async function sendEmail({prospect,message,idempotencyKey}) {
  if(!process.env.WIS_EMAIL_WEBHOOK_URL||!process.env.WIS_EMAIL_WEBHOOK_TOKEN) return {ok:false,error:"EMAIL_PROVIDER_NOT_CONFIGURED",status:409};
  if(process.env.WIS_EMAIL_OUTBOUND_ENABLED!=="true") return {ok:false,error:"CHANNEL_BLOCKED",status:409};
  const firstLine=message.split(/\r?\n/,1)[0];
  const subject=/^asunto\s*:/i.test(firstLine)?firstLine.replace(/^asunto\s*:\s*/i,"").trim():`Una idea para ${prospect.empresa}`;
  const body=/^asunto\s*:/i.test(firstLine)?message.split(/\r?\n/).slice(1).join("\n").trim():message;
  const signatureHtml=String(process.env.WIS_EMAIL_SIGNATURE_HTML||"");
  if(!signatureHtml||/gravatar(?:\.com)?/i.test(signatureHtml)) return {ok:false,error:"EMAIL_SIGNATURE_NOT_APPROVED",status:409};
  const result=await postJson(process.env.WIS_EMAIL_WEBHOOK_URL,{
    to:prospect.email,
    from:"Ortu - WIS <ortu@wis-agency.com>",
    replyTo:"ortu@wis-agency.com",
    subject,
    body,
    signatureHtml,
    idempotencyKey,
    prospect:{rowNumber:prospect.rowNumber,empresa:prospect.empresa}
  },{authorization:`Bearer ${process.env.WIS_EMAIL_WEBHOOK_TOKEN}`});
  if(!result.ok) return {ok:false,error:"PROVIDER_REJECTED",status:502,providerStatus:result.status};
  return {ok:true,providerMessageId:result.body.messageId||result.body.id||"accepted"};
}

async function sendWhatsapp({prospect,message,idempotencyKey}) {
  if(!process.env.WIS_WHATSAPP_WEBHOOK_URL||!process.env.WIS_WHATSAPP_WEBHOOK_TOKEN) return {ok:false,error:"WHATSAPP_PROVIDER_NOT_CONFIGURED",status:409};
  if(process.env.WIS_WHATSAPP_OUTBOUND_ENABLED!=="true") return {ok:false,error:"CHANNEL_BLOCKED",status:409};
  const result=await postJson(process.env.WIS_WHATSAPP_WEBHOOK_URL,{connection:"wis-5679",owner:"WIS",to:prospect.whatsappE164,type:"text",body:message,idempotencyKey},{
    authorization:`Bearer ${process.env.WIS_WHATSAPP_WEBHOOK_TOKEN}`,
    "idempotency-key":idempotencyKey
  });
  if(!result.ok) return {ok:false,error:"PROVIDER_REJECTED",status:502,providerStatus:result.status};
  return {ok:true,providerMessageId:result.body?.data?.id||result.body?.id||"accepted"};
}

async function processSend(input) {
  if(input.confirmed!==true) return {status:400,body:{ok:false,error:"HUMAN_CONFIRMATION_REQUIRED"}};
  const channel=String(input.channel||"").toUpperCase();
  if(!["EMAIL","WHATSAPP"].includes(channel)) return {status:400,body:{ok:false,error:"CHANNEL_INVALID"}};
  const payload=await dashboardPayload();
  const prospect=payload.prospects.find(row=>row.rowNumber===Number(input.rowNumber));
  if(!prospect) return {status:404,body:{ok:false,error:"PROSPECT_NOT_FOUND"}};
  const recipient=channel==="EMAIL"?prospect.email:prospect.whatsapp;
  if(!recipient) return {status:400,body:{ok:false,error:"RECIPIENT_MISSING"}};
  if(channel==="WHATSAPP"&&!prospect.whatsappE164) return {status:400,body:{ok:false,error:"WHATSAPP_PHONE_INVALID"}};
  const message=String(input.message||"").trim();
  if(!message) return {status:400,body:{ok:false,error:"MESSAGE_REQUIRED"}};
  const snapshot=await readJson(sheetSnapshotPath,{});
  const gate=approvalGate(snapshot,prospect,channel);
  if(!gate.eligible) return {status:409,body:{ok:false,error:gate.reason}};
  if(hash(message)!==gate.approvedMessageHash) return {status:409,body:{ok:false,error:"MESSAGE_CHANGED"}};
  const verification=await readJson(channelVerificationPath,{});
  const health=channelHealth(verification);
  const selectedHealth=channel==="EMAIL"?health.email:health.whatsapp;
  if(!selectedHealth.canSend) return {status:409,body:{ok:false,error:selectedHealth.configured?"CHANNEL_BLOCKED":channel==="EMAIL"?"EMAIL_PROVIDER_NOT_CONFIGURED":"WHATSAPP_PROVIDER_NOT_CONFIGURED"}};
  const stopGate=prospectStopGate(payload.events,prospect,channel);
  if(!stopGate.eligible) return {status:409,body:{ok:false,error:stopGate.reason}};
  const limitGate=channelLimitGate(payload.events,channel);
  if(!limitGate.eligible) return {status:409,body:{ok:false,error:limitGate.reason}};
  const optIn=channel==="WHATSAPP"?whatsappOptInGate(snapshot,prospect):null;
  if(optIn&&!optIn.eligible) return {status:409,body:{ok:false,error:optIn.reason}};
  if(channel==="WHATSAPP") {
    const emailSent=payload.events.some(row=>row.channel==="EMAIL"&&isSuccessfulSend(row)&&
      ((row.source==="DASHBOARD"&&Number(row.rowNumber)===prospect.rowNumber)||(prospect.email&&key(row.recipient)===key(prospect.email))));
    if(!emailSent) return {status:409,body:{ok:false,error:"EMAIL_FIRST_REQUIRED"}};
  }
  const idempotencyKey=gate.idempotencyKey;
  const releaseLocks=acquireSendLocks([`message:${idempotencyKey}`,`channel:${channel}`]);
  if(!releaseLocks) return {status:409,body:{ok:false,error:"SEND_IN_PROGRESS"}};
  try {
    const freshPayload=await dashboardPayload();
    const freshSnapshot=await readJson(sheetSnapshotPath,{});
    const freshProspect=freshPayload.prospects.find(row=>row.rowNumber===prospect.rowNumber);
    const freshGate=approvalGate(freshSnapshot,freshProspect,channel);
    if(!freshGate.eligible) return {status:409,body:{ok:false,error:freshGate.reason}};
    const freshStopGate=prospectStopGate([...freshPayload.events,...(freshSnapshot.outreachQueue||[])],freshProspect,channel);
    if(!freshStopGate.eligible) return {status:409,body:{ok:false,error:freshStopGate.reason}};
    const freshLimitGate=channelLimitGate(freshPayload.events,channel);
    if(!freshLimitGate.eligible) return {status:409,body:{ok:false,error:freshLimitGate.reason}};
    const previous=freshPayload.events.find(row=>row.idempotencyKey===idempotencyKey&&/SEND_ATTEMPT|SENT|OUTCOME_UNKNOWN/i.test(row.eventType||""));
    if(previous) return {status:409,body:{ok:false,error:"DUPLICATE_IDEMPOTENCY_KEY",eventId:previous.eventId}};
    const baseEvent={rowNumber:prospect.rowNumber,empresa:prospect.empresa,channel,recipient,idempotencyKey,messageHash:hash(message),approvalId:gate.approvalId,campaignId:gate.campaignId,batchId:gate.batchId,messageVersion:gate.messageVersion,approval:"HUMAN_DASHBOARD_CLICK",source:"DASHBOARD",optInProviderEventIdHash:channel==="WHATSAPP"?hash(optIn.providerEventId):null,optInRecordedAt:optIn?.recordedAt||null,optInSource:optIn?.source||null,optInScope:optIn?.scope||null};
    await appendEvent({...baseEvent,eventType:"SEND_ATTEMPT"});
    const result=channel==="EMAIL"?await sendEmail({prospect,message,idempotencyKey}):await sendWhatsapp({prospect,message,idempotencyKey});
    if(!result.ok) {
      await appendEvent({...baseEvent,eventType:"SEND_BLOCKED",detail:result.error,providerStatus:result.providerStatus||null});
      return {status:result.status||409,body:{ok:false,error:result.error}};
    }
    const event=await appendEvent({...baseEvent,eventType:"SENT",providerMessageIdHash:hash(result.providerMessageId)});
    return {status:200,body:{ok:true,eventId:event.eventId,idempotencyKey}};
  } catch(error) {
    const event=await appendEvent({rowNumber:prospect.rowNumber,empresa:prospect.empresa,channel,recipient,idempotencyKey,messageHash:hash(message),approvalId:gate.approvalId,campaignId:gate.campaignId,batchId:gate.batchId,messageVersion:gate.messageVersion,approval:"HUMAN_DASHBOARD_CLICK",source:"DASHBOARD",eventType:"OUTCOME_UNKNOWN",detail:error.name||"NETWORK_ERROR"});
    return {status:502,body:{ok:false,error:"OUTCOME_UNKNOWN",eventId:event.eventId,detail:"Resultado incierto: no se reintentará hasta reconciliar."}};
  } finally {
    releaseLocks();
  }
}

async function syncFromProxy() {
  if(!process.env.WIS_SHEETS_PROXY_URL) return {status:409,body:{ok:false,error:"SHEETS_PROXY_NOT_CONFIGURED",detail:"La vista usa el último snapshot real; falta conectar el proxy de actualización automática."}};
  const response=await fetch(process.env.WIS_SHEETS_PROXY_URL,{headers:process.env.WIS_SHEETS_PROXY_TOKEN?{authorization:`Bearer ${process.env.WIS_SHEETS_PROXY_TOKEN}`}:{},signal:AbortSignal.timeout(30_000)});
  if(!response.ok) return {status:502,body:{ok:false,error:"SHEETS_PROXY_FAILED",detail:`HTTP ${response.status}`}};
  const snapshot=await response.json();
  snapshot.fetchedAt=new Date().toISOString();
  snapshot.source="GOOGLE_SHEETS_LIVE";
  snapshot.prospects=(snapshot.prospects||[]).map(normalizeProspect);
  await writeJsonAtomic(sheetSnapshotPath,snapshot);
  return {status:200,body:{ok:true,rows:snapshot.prospects.length,fetchedAt:snapshot.fetchedAt}};
}

const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname==="/api/dashboard"&&req.method==="GET") return json(res,200,await dashboardPayload());
    if(url.pathname==="/api/sync"&&req.method==="POST") {
      assertLocalMutation(req);
      const result=await syncFromProxy();
      return json(res,result.status,result.body);
    }
    if(url.pathname==="/api/snapshots/sheets"&&req.method==="POST") {
      assertLocalMutation(req);
      const configuredToken=process.env.WIS_DASHBOARD_INGEST_TOKEN;
      if(!configuredToken) return json(res,503,{ok:false,error:"INGEST_DISABLED"});
      if(req.headers["x-wis-dashboard-token"]!==configuredToken) return json(res,401,{ok:false,error:"INGEST_TOKEN_INVALID"});
      const snapshot=await requestBody(req,4_000_000);
      snapshot.fetchedAt=snapshot.fetchedAt||new Date().toISOString();
      snapshot.source=snapshot.source||"GOOGLE_SHEETS_LIVE";
      snapshot.prospects=(snapshot.prospects||[]).map(normalizeProspect);
      await writeJsonAtomic(sheetSnapshotPath,snapshot);
      return json(res,200,{ok:true,rows:snapshot.prospects.length,fetchedAt:snapshot.fetchedAt});
    }
    if(url.pathname==="/api/outreach/send"&&req.method==="POST") {
      assertLocalMutation(req);
      const result=await processSend(await requestBody(req));
      return json(res,result.status,result.body);
    }
    if(url.pathname==="/api/actions"&&req.method==="POST") {
      assertLocalMutation(req);
      const input=await requestBody(req);
      if(!allowedActions.has(input.action)) return json(res,400,{ok:false,error:"ACTION_NOT_ALLOWED"});
      const idempotencyKey=String(input.idempotencyKey||`${input.action}:${new Date().toISOString().slice(0,16)}`).slice(0,180);
      const existing=(await readNdjson(commandsPath,100)).find(item=>item.idempotencyKey===idempotencyKey);
      if(existing) return json(res,200,{ok:true,command:existing,deduplicated:true});
      const command={commandId:`CMD-${Date.now()}-${randomUUID().slice(0,8)}`,createdAt:new Date().toISOString(),action:input.action,scope:String(input.scope||"NEXT_PENDING_BATCH").slice(0,120),source:"WIS_DASHBOARD",requestedBy:"human-local",status:"NEW",idempotencyKey};
      await appendFile(commandsPath,`${JSON.stringify(command)}\n`,"utf8");
      return json(res,202,{ok:true,command});
    }
    const requested=url.pathname==="/"? "index.html":url.pathname.slice(1);
    const file=normalize(join(publicDir,requested));
    if(!file.startsWith(publicDir)) return json(res,403,{error:"FORBIDDEN"});
    const bytes=await readFile(file);
    res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store","x-content-type-options":"nosniff"});
    res.end(bytes);
  } catch(error) {
    if(error?.code==="ENOENT") return json(res,404,{error:"NOT_FOUND"});
    return json(res,error.status||500,{error:error.message||"SERVER_ERROR"});
  }
});

const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]);
if(isMain) server.listen(port,"127.0.0.1",()=>process.stdout.write(`WIS Command Center: http://127.0.0.1:${port}/#prospects\n`));

export { acquireSendLocks, approvalGate, channelHealth, channelLimitGate, explicitE164, normalizeProspect, prospectStopGate, server, whatsappOptInGate };
