import { createServer } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendOutreachEvent,
  appendOutreachQueue,
  appendTaskCommand,
  buildLiveSnapshot,
  sheetsLiveConfigured,
  sheetsWriteConfigured,
  updateOutreachQueue,
  updateProspectMessage
} from "./sheets-live.mjs";

const standaloneRoot=process.env.WIS_STANDALONE_ROOT?resolve(process.env.WIS_STANDALONE_ROOT):null;
const root = standaloneRoot||fileURLToPath(new URL("../../../..", import.meta.url));
const publicDir = standaloneRoot?join(root,"out"):join(root, "ops", "reports", "web", "wis-operations-dashboard", "out");
const configDir = standaloneRoot?join(root,"config"):join(root, "ops", "config");
const runtimeDir = standaloneRoot?join(root,"runtime"):join(root, "ops", "runtime");
const commandsPath = join(runtimeDir, "dashboard-commands.ndjson");
const sheetSnapshotPath = join(runtimeDir, "dashboard-sheet-snapshot.json");
const outreachEventsPath = join(runtimeDir, "dashboard-outreach-events.ndjson");
const statePath = join(configDir, "dashboard-state.json");
const channelVerificationPath = join(configDir, "channel-verification.json");
const port = Number(process.env.PORT || process.env.WIS_DASHBOARD_PORT || 4174);
const bindHost = process.env.WIS_BIND_HOST || "127.0.0.1";
const allowedActions = new Set(["CONTINUE_RESEARCH", "RUN_QA", "REFRESH_SNAPSHOT", "PREPARE_DRAFTS", "EVALUATE_APOLLO"]);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" };
const activeSendLocks = new Set();
let liveSyncPromise=null;
let lastLiveSyncAt=0;

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

function secureEqual(left,right) {
  const a=Buffer.from(String(left||""));
  const b=Buffer.from(String(right||""));
  return a.length===b.length&&timingSafeEqual(a,b);
}

function dashboardAuthorized(req) {
  if(process.env.WIS_REQUIRE_AUTH!=="true") return true;
  const encoded=String(req.headers.authorization||"").replace(/^Basic\s+/i,"");
  if(!encoded) return false;
  let decoded="";
  try { decoded=Buffer.from(encoded,"base64").toString("utf8"); } catch { return false; }
  const separator=decoded.indexOf(":");
  if(separator<0) return false;
  const username=decoded.slice(0,separator);
  const password=decoded.slice(separator+1);
  return secureEqual(username,process.env.WIS_DASHBOARD_USERNAME)&&secureEqual(hash(password),process.env.WIS_DASHBOARD_PASSWORD_SHA256);
}

async function refreshLiveSheets(force=false) {
  if(!sheetsLiveConfigured()) return null;
  const ttl=Math.max(15,Number(process.env.WIS_SHEETS_REFRESH_SECONDS||30))*1000;
  if(!force&&Date.now()-lastLiveSyncAt<ttl) return null;
  if(liveSyncPromise) return liveSyncPromise;
  liveSyncPromise=(async()=>{
    const snapshot=await buildLiveSnapshot();
    await writeJsonAtomic(sheetSnapshotPath,snapshot);
    lastLiveSyncAt=Date.now();
    return snapshot;
  })();
  try { return await liveSyncPromise; }
  finally { liveSyncPromise=null; }
}

function key(value) {
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
}

function isLocalRequest(req) {
  const address=req.socket.remoteAddress||"";
  return address==="127.0.0.1"||address==="::1"||address==="::ffff:127.0.0.1";
}

function assertMutationRequest(req) {
  const origin=String(req.headers.origin||"");
  if(isLocalRequest(req)) {
    if(origin&&!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw Object.assign(new Error("ORIGIN_BLOCKED"),{status:403});
    return;
  }
  if(process.env.WIS_ALLOW_REMOTE_MUTATIONS!=="true") throw Object.assign(new Error("REMOTE_MUTATIONS_DISABLED"),{status:403});
  const forwardedHost=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim();
  const forwardedProto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0].trim();
  const expected=`${forwardedProto}://${forwardedHost}`;
  if(!origin||origin!==expected) throw Object.assign(new Error("ORIGIN_BLOCKED"),{status:403});
  const fetchSite=String(req.headers["sec-fetch-site"]||"");
  if(fetchSite&&fetchSite!=="same-origin") throw Object.assign(new Error("CROSS_SITE_MUTATION_BLOCKED"),{status:403});
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
    idempotencyKey,
    prospectKey
  };
}

function cleanText(value,max=180) {
  return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
}

function titleCase(value) {
  return cleanText(value)
    .toLocaleLowerCase("es-AR")
    .replace(/(^|[\s/-])(\p{L})/gu,(_,prefix,letter)=>`${prefix}${letter.toLocaleUpperCase("es-AR")}`)
    .replace(/\b(Y|E|De|Del|La|Las|El|Los|En)\b/g,(word,_,offset)=>offset===0?word:word.toLocaleLowerCase("es-AR"));
}

function normalizeResearchRequest(input={}) {
  const prompt=cleanText(input.prompt,1000);
  const inferredQuantity=prompt.match(/\b(\d{1,3})\b/)?.[1];
  const quantity=Math.max(1,Math.min(300,Number(input.quantity||inferredQuantity||25)));
  const promptKey=key(prompt);
  let businessType=cleanText(input.businessType,40).toLowerCase();
  if(!businessType) businessType=promptKey.includes("logistic")?"logisticas":promptKey.includes("distribuidor")?"distribuidoras":promptKey.includes("proveedor")?"proveedores":"empresas";
  if(!["distribuidoras","logisticas","proveedores","empresas","otro"].includes(businessType)) businessType="otro";
  const knownCountries=["Argentina","Chile","Uruguay","Paraguay","Bolivia","Perú","Colombia","México","Brasil","Ecuador"];
  const promptCountry=knownCountries.find(country=>promptKey.includes(key(country)))||"";
  let industry=cleanText(input.industry,90);
  if(!industry&&prompt) {
    const match=prompt.match(/(?:distribuidoras?|log[ií]sticas?|proveedores?|empresas?)\s+(?:de|del\s+rubro\s+)?([^,.]+?)(?=\s+(?:en|con|incluyendo|junto)\b|$)/iu);
    industry=cleanText(match?.[1],90);
  }
  if(industry&&(promptCountry&&key(industry).includes(key(promptCountry))||/\bempleados?\b/i.test(industry))) {
    industry=businessType==="logisticas"?"Logística y transporte":businessType==="distribuidoras"?"Distribución general":"Servicios B2B";
  }
  const country=cleanText(input.country,60)||promptCountry;
  const region=cleanText(input.region,80);
  let location=cleanText(input.location,90);
  if(!location&&prompt) {
    const match=prompt.match(/\ben\s+([^,.]+?)(?=\s+(?:con|incluyendo|junto|y\s+analiz)\b|$)/iu);
    location=cleanText(match?.[1],90);
  }
  location=region&&country?`${region}, ${country}`:region||country||location||"Argentina";
  const reviews=input.reviews==="none"?"none":"1-3";
  const contact=["email","whatsapp","both"].includes(input.contact)?input.contact:"both";
  const inferredEmployeeSize=prompt.match(/\b(1-10|11-20|11-50|20-50|51-200|201-500)\s+empleados?\b/i)?.[1];
  const employeeSize=["any","1-10","11-20","11-50","20-50","51-200","201-500"].includes(input.employeeSize)?input.employeeSize:(inferredEmployeeSize||"11-50");
  const minimumReviews=[0,5,10,20,50,100].includes(Number(input.minimumReviews))?Number(input.minimumReviews):10;
  const destination=["Distribuidoras_300","Logisticas_LATAM","Prospectos_Custom"].includes(input.destination)?input.destination:(businessType==="logisticas"?"Logisticas_LATAM":"Distribuidoras_300");
  const priority=["NORMAL","HIGH","URGENT"].includes(input.priority)?input.priority:"NORMAL";
  const businessLabel={distribuidoras:"distribuidoras",logisticas:"logísticas",proveedores:"proveedores B2B",empresas:"empresas de servicios",otro:"empresas"}[businessType];
  const batchName=cleanText(input.batchName,80)||`${quantity} ${businessLabel} · ${industry||"General"} · ${country||location}`;
  const objective=cleanText(input.objective,400)||"Detectar problemas recurrentes y oportunidades concretas para WIS";
  if(!industry) throw Object.assign(new Error("RESEARCH_INDUSTRY_REQUIRED"),{status:400});
  return {
    quantity,
    businessType,
    industry:titleCase(industry),
    location:titleCase(location),
    country:titleCase(country||location),
    region:titleCase(region),
    employeeSize,
    minimumReviews:reviews==="none"?0:minimumReviews,
    excludeLargeCorporations:input.excludeLargeCorporations!==false,
    destination,
    priority,
    batchName,
    reviews,
    contact,
    objective,
    prompt,
    reviewRule:reviews==="1-3"?"Analizar sólo reseñas de 1, 2 y 3 estrellas e informar analizadas/total accesible":"Sin análisis de reseñas",
    outreachRule:"Preparar borradores; no enviar sin QA y aprobación"
  };
}

function researchCommand(row={}) {
  let evidence={};
  try { evidence=typeof row.evidence==="string"?JSON.parse(row.evidence):row.evidence||{}; } catch { evidence={}; }
  const storedRequest=evidence&&typeof evidence==="object"&&Number.isFinite(Number(evidence.quantity))?evidence:null;
  let request=storedRequest;
  if(storedRequest?.prompt&&(!storedRequest.employeeSize||!storedRequest.country||/\bempleados?\b/i.test(storedRequest.industry||""))) {
    try {
      request={...storedRequest,...normalizeResearchRequest({prompt:storedRequest.prompt,quantity:storedRequest.quantity})};
    } catch { request=storedRequest; }
  }
  const status=cleanText(row.status||"NEW",40).toUpperCase()||"NEW";
  const quantity=Math.max(0,Number(request?.quantity||0));
  const completed=Math.max(0,Math.min(quantity,Number(evidence?.progress?.completed||row.completed||(status==="DONE"?quantity:0))));
  return {
    commandId:cleanText(row.commandId||row.command_id,100),
    createdAt:cleanText(row.createdAt||row.created_at,60),
    action:cleanText(row.action,50),
    scope:cleanText(row.scope,180),
    status,
    source:cleanText(row.source,50),
    idempotencyKey:cleanText(row.idempotencyKey||row.idempotency_key,200),
    request,
    progress:{completed,total:quantity,percent:quantity?Math.round(completed/quantity*100):0},
    updatedAt:cleanText(row.updatedAt||row.updated_at||row.createdAt||row.created_at,60),
    error:cleanText(row.error||row.last_error,240)
  };
}

function researchState(sheetCommands=[],localCommands=[]) {
  const rows=[...sheetCommands,...localCommands].map(researchCommand).filter(row=>["REQUEST_RESEARCH","CONTINUE_RESEARCH"].includes(row.action));
  const unique=[];
  for(const row of rows) {
    const identity=row.idempotencyKey||row.commandId;
    if(!identity||unique.some(existing=>(existing.idempotencyKey||existing.commandId)===identity)) continue;
    unique.push(row);
  }
  unique.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const pending=new Set(["NEW","READY","PENDING"]);
  return {
    requests:unique.slice(0,50),
    summary:{
      total:unique.length,
      pending:unique.filter(row=>pending.has(row.status)).length,
      running:unique.filter(row=>row.status==="IN_PROGRESS").length,
      completed:unique.filter(row=>row.status==="DONE").length,
      blocked:unique.filter(row=>["BLOCKED","CANCELLED","FAILED"].includes(row.status)).length
    },
    executor:{connected:false,label:"Ejecutor de research pendiente de conexión"}
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
  const emailConfigured=Boolean(process.env.BREVO_API_KEY||(process.env.WIS_EMAIL_WEBHOOK_URL&&process.env.WIS_EMAIL_WEBHOOK_TOKEN));
  const waConfigured=Boolean(process.env.WIS_WHATSAPP_WEBHOOK_URL&&process.env.WIS_WHATSAPP_WEBHOOK_TOKEN);
  const emailConnected=(verification.email?.aliasVerified===true&&verification.email?.defaultSender===true)||
    (process.env.WIS_EMAIL_ALIAS_VERIFIED==="true"&&process.env.WIS_EMAIL_DEFAULT_SENDER_VERIFIED==="true");
  const whatsappConnected=(verification.whatsapp?.identityVerified===true&&verification.whatsapp?.sessionConnected===true)||
    (process.env.WIS_WHATSAPP_IDENTITY_VERIFIED==="true"&&process.env.WIS_WHATSAPP_SESSION_CONNECTED==="true");
  const signatureApproved=(verification.email?.signatureApproved===true||process.env.WIS_EMAIL_SIGNATURE_APPROVED==="true")&&Boolean(process.env.WIS_EMAIL_SIGNATURE_HTML);
  const whatsappPaused=verification.whatsapp?.outboundPaused!==undefined?verification.whatsapp.outboundPaused!==false:process.env.WIS_WHATSAPP_OUTBOUND_PAUSED!=="false";
  return {
    email:{
      provider:process.env.BREVO_API_KEY?"Brevo transactional":"Gmail / Brevo",
      account:"Ortu - WIS <ortu@wis-agency.com>",
      canSend:emailConfigured&&emailConnected&&signatureApproved&&process.env.WIS_EMAIL_OUTBOUND_ENABLED==="true",
      configured:emailConfigured,
      connected:emailConnected,
      detail:!emailConnected?"Falta verificar el alias y el remitente predeterminado.":!signatureApproved?"Alias verificado; falta aprobar y cargar la firma HTML WIS.":!emailConfigured?"Alias y firma verificados; falta el webhook exclusivo de envío.":"El adaptador está conectado y permanece pausado hasta habilitar el canal."
    },
    whatsapp:{
      provider:"Workflow WIS · 5679",
      account:"línea WIS · •••• 5679",
      canSend:waConfigured&&whatsappConnected&&!whatsappPaused&&process.env.WIS_WHATSAPP_OUTBOUND_ENABLED==="true",
      configured:waConfigured,
      connected:whatsappConnected,
      detail:!whatsappConnected?"Falta verificar la identidad y la sesión exclusiva de la línea 5679.":whatsappPaused?"Identidad y sesión 5679 verificadas; la salida continúa pausada.":!waConfigured?"La línea está verificada; falta conectar el workflow WIS exclusivo.":"El workflow WIS está conectado y permanece bloqueado hasta habilitar el canal."
    }
  };
}

async function whatsappProviderConfig() {
  const apiUrl=String(process.env.WIS_WHATSAPP_API_URL||"").trim().replace(/\/$/,"");
  const apiToken=String(process.env.WIS_WHATSAPP_API_TOKEN||"").trim();
  if(apiUrl&&apiToken) return {apiUrl,apiToken,source:"environment"};
  const local=await readJson(join(runtimeDir,"channel-secrets.local.json"),null);
  if(!local?.whatsappApiUrl||!local?.whatsappApiToken) return null;
  return {
    apiUrl:String(local.whatsappApiUrl).replace(/\/$/,""),
    apiToken:String(local.whatsappApiToken),
    source:"local-runtime"
  };
}

function whatsappQuery(input={}) {
  const output=new URLSearchParams();
  const limit=Math.min(100,Math.max(1,Number(input.limit)||40));
  const offset=Math.min(100000,Math.max(0,Number(input.offset)||0));
  output.set("limit",String(limit));
  output.set("offset",String(offset));
  const query=cleanText(input.q,100);
  if(query.length>=2) output.set("q",query);
  const conversationId=cleanText(input.conversation_id,200);
  if(conversationId) output.set("conversation_id",conversationId);
  if(input.sort==="asc"||input.sort==="desc") output.set("sort",input.sort);
  if(input.normal_types==="true") output.set("normal_types","true");
  return output;
}

async function whatsappProviderGet(resource,params={}) {
  const config=await whatsappProviderConfig();
  if(!config) throw Object.assign(new Error("WHATSAPP_PROVIDER_NOT_CONFIGURED"),{status:503});
  if(!["connections","conversations","messages"].includes(resource)) throw Object.assign(new Error("WHATSAPP_RESOURCE_BLOCKED"),{status:400});
  const url=new URL(`${config.apiUrl}/${resource}`);
  const query=whatsappQuery(params);
  for(const [name,value] of query) url.searchParams.set(name,value);
  const response=await fetch(url,{headers:{authorization:`Bearer ${config.apiToken}`},signal:AbortSignal.timeout(10_000)});
  let body={};
  try { body=await response.json(); } catch { /* provider returned no JSON */ }
  if(!response.ok) throw Object.assign(new Error(body.error||"WHATSAPP_PROVIDER_UNAVAILABLE"),{status:response.status>=400&&response.status<500?response.status:502});
  return {data:body.data??null,meta:body.meta??null,source:config.source};
}

async function dashboardPayload() {
  try { await refreshLiveSheets(false); } catch { /* keep the last valid snapshot and surface degraded sync below */ }
  const [snapshot,state,localEvents,localCommands,verification]=await Promise.all([
    readJson(sheetSnapshotPath,{fetchedAt:null,source:"NONE",prospects:[],events:[]}),
    readJson(statePath,{}),
    readNdjson(outreachEventsPath,500),
    readNdjson(commandsPath,200),
    readJson(channelVerificationPath,{})
  ]);
  const prospects=(snapshot.prospects||[]).map(normalizeProspect);
  const queue=Array.isArray(snapshot.outreachQueue)?snapshot.outreachQueue:[];
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
  const research=researchState(snapshot.commands||[],localCommands);
  return {
    generatedAt:new Date().toISOString(),
    prospects,
    queue,
    events:events.slice(0,500),
    research,
    stats:{
      prospects:prospects.length,
      bothChannels:prospects.filter(row=>row.email&&row.whatsapp).length,
      ready:prospects.filter(candidateReady).length,
      contacted:contactedRows.size,
      events:events.length,
      emailSent,
      whatsappSent,
      replies,
      queued:queue.length,
      blocked:queue.filter(row=>/BLOQUEADO|DESCARTADO/i.test(row.status||"")).length,
      bounced:queue.filter(row=>/REBOTADO|HARD_BOUNCE|SOFT_BOUNCE/i.test(`${row.status||""} ${row.outcome||""}`)).length
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
  if(sheetsWriteConfigured()) await appendOutreachEvent(complete);
  try { await appendFile(outreachEventsPath,`${JSON.stringify(complete)}\n`,"utf8"); }
  catch(error) { if(!sheetsWriteConfigured()) throw error; }
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
  const directBrevo=Boolean(process.env.BREVO_API_KEY);
  if(!directBrevo&&(!process.env.WIS_EMAIL_WEBHOOK_URL||!process.env.WIS_EMAIL_WEBHOOK_TOKEN)) return {ok:false,error:"EMAIL_PROVIDER_NOT_CONFIGURED",status:409};
  if(process.env.WIS_EMAIL_OUTBOUND_ENABLED!=="true") return {ok:false,error:"CHANNEL_BLOCKED",status:409};
  const firstLine=message.split(/\r?\n/,1)[0];
  const subject=/^asunto\s*:/i.test(firstLine)?firstLine.replace(/^asunto\s*:\s*/i,"").trim():`Una idea para ${prospect.empresa}`;
  const body=/^asunto\s*:/i.test(firstLine)?message.split(/\r?\n/).slice(1).join("\n").trim():message;
  const signatureHtml=String(process.env.WIS_EMAIL_SIGNATURE_HTML||"");
  if(!signatureHtml||/gravatar(?:\.com)?/i.test(signatureHtml)) return {ok:false,error:"EMAIL_SIGNATURE_NOT_APPROVED",status:409};
  const payload={
    to:prospect.email,
    from:"Ortu - WIS <ortu@wis-agency.com>",
    replyTo:"ortu@wis-agency.com",
    subject,
    body,
    signatureHtml,
    idempotencyKey,
    prospect:{rowNumber:prospect.rowNumber,empresa:prospect.empresa}
  };
  const result=directBrevo?await postJson("https://api.brevo.com/v3/smtp/email",{
    sender:{name:"Ortu - WIS",email:"ortu@wis-agency.com"},
    to:[{email:prospect.email,name:prospect.empresa}],
    replyTo:{email:"ortu@wis-agency.com",name:"Ortu - WIS"},
    subject,
    htmlContent:`<div style="font-family:Arial,sans-serif;white-space:normal">${body.replace(/[&<>\"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"})[char]).replace(/\r?\n/g,"<br>")}</div>${signatureHtml}`,
    headers:{"X-WIS-Idempotency-Key":idempotencyKey}
  },{"api-key":process.env.BREVO_API_KEY,accept:"application/json"}):await postJson(process.env.WIS_EMAIL_WEBHOOK_URL,payload,{authorization:`Bearer ${process.env.WIS_EMAIL_WEBHOOK_TOKEN}`});
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
  const messageId=`MSG-${Date.now()}-${hash(idempotencyKey).slice(0,10)}`;
  let queueRowNumber=null;
  let queueRecord=null;
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
    if(!sheetsWriteConfigured()) return {status:409,body:{ok:false,error:"DURABLE_OPERATIONS_WRITE_REQUIRED"}};
    queueRecord={
      messageId,idempotencyKey,prospectKey:freshGate.prospectKey,campaignId:freshGate.campaignId,batchId:freshGate.batchId,
      sourceSheet:"Distribuidoras_300",rowNumber:prospect.rowNumber,empresa:prospect.empresa,channel,sequence:1,recipient,
      messageVersion:freshGate.messageVersion,approvalId:freshGate.approvalId,eligibility:"VERIFIED",status:"EN_COLA",
      scheduledAt:new Date().toISOString(),attempts:0,nextAction:"Enviar por adaptador aprobado",
      optInVerified:channel==="WHATSAPP",optInSource:optIn?.source||"",optInRecordedAt:optIn?.recordedAt||"",
      within24hAtEvaluation:channel==="WHATSAPP",templateId:""
    };
    const queued=await appendOutreachQueue(queueRecord);
    queueRowNumber=queued.rowNumber;
    if(!queueRowNumber) throw new Error("OUTREACH_QUEUE_APPEND_UNCONFIRMED");
    const baseEvent={messageId,rowNumber:prospect.rowNumber,empresa:prospect.empresa,channel,recipient,idempotencyKey,messageHash:hash(message),approvalId:gate.approvalId,campaignId:gate.campaignId,batchId:gate.batchId,messageVersion:gate.messageVersion,approval:"HUMAN_DASHBOARD_CLICK",source:"DASHBOARD",actor:"human-dashboard",fromStatus:"APROBADO",toStatus:"EN_COLA",evidence:`approval=${gate.approvalId};message_sha256=${hash(message)}`,optInProviderEventIdHash:channel==="WHATSAPP"?hash(optIn.providerEventId):null,optInRecordedAt:optIn?.recordedAt||null,optInSource:optIn?.source||null,optInScope:optIn?.scope||null};
    await appendEvent({...baseEvent,eventType:"SEND_ATTEMPT"});
    const result=channel==="EMAIL"?await sendEmail({prospect,message,idempotencyKey}):await sendWhatsapp({prospect,message,idempotencyKey});
    if(!result.ok) {
      queueRecord={...queueRecord,status:"BLOQUEADO",lastError:result.error,attempts:1,nextAction:"Corregir configuración; no reintentar automáticamente"};
      await updateOutreachQueue(queueRowNumber,queueRecord);
      await appendEvent({...baseEvent,fromStatus:"EN_COLA",toStatus:"BLOQUEADO",eventType:"SEND_BLOCKED",detail:result.error,providerStatus:result.providerStatus||null});
      return {status:result.status||409,body:{ok:false,error:result.error}};
    }
    queueRecord={...queueRecord,status:"ENVIADO",sentAt:new Date().toISOString(),providerRef:hash(result.providerMessageId),outcome:"PENDIENTE_RESPUESTA",attempts:1,nextAction:"Monitorear respuesta"};
    await updateOutreachQueue(queueRowNumber,queueRecord);
    const event=await appendEvent({...baseEvent,fromStatus:"EN_COLA",toStatus:"ENVIADO",eventType:"SENT",providerRef:hash(result.providerMessageId),providerMessageIdHash:hash(result.providerMessageId)});
    return {status:200,body:{ok:true,eventId:event.eventId,idempotencyKey}};
  } catch(error) {
    if(queueRowNumber&&queueRecord) {
      queueRecord={...queueRecord,status:"OUTCOME_UNKNOWN",lastError:error.name||"NETWORK_ERROR",attempts:1,nextAction:"Reconciliar proveedor antes de reintentar"};
      try { await updateOutreachQueue(queueRowNumber,queueRecord); } catch { /* preserve original uncertain result */ }
    }
    const event=await appendEvent({messageId,rowNumber:prospect.rowNumber,empresa:prospect.empresa,channel,recipient,idempotencyKey,messageHash:hash(message),approvalId:gate.approvalId,campaignId:gate.campaignId,batchId:gate.batchId,messageVersion:gate.messageVersion,approval:"HUMAN_DASHBOARD_CLICK",source:"DASHBOARD",actor:"wis-command-center",fromStatus:queueRowNumber?"EN_COLA":"APROBADO",toStatus:"OUTCOME_UNKNOWN",eventType:"OUTCOME_UNKNOWN",detail:error.name||"NETWORK_ERROR",evidence:"Requiere reconciliación durable antes de reintentar"});
    return {status:502,body:{ok:false,error:"OUTCOME_UNKNOWN",eventId:event.eventId,detail:"Resultado incierto: no se reintentará hasta reconciliar."}};
  } finally {
    releaseLocks();
  }
}

async function syncFromProxy() {
  if(sheetsLiveConfigured()) {
    try {
      const snapshot=await refreshLiveSheets(true);
      return {status:200,body:{ok:true,rows:snapshot.prospects.length,queue:snapshot.outreachQueue.length,events:snapshot.events.length,fetchedAt:snapshot.fetchedAt}};
    } catch(error) {
      return {status:502,body:{ok:false,error:"GOOGLE_SHEETS_SYNC_FAILED",detail:error.message}};
    }
  }
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
    if(url.pathname==="/health"&&req.method==="GET") return json(res,200,{status:"ok",sheetsConfigured:sheetsLiveConfigured(),authRequired:process.env.WIS_REQUIRE_AUTH==="true"});
    if(!dashboardAuthorized(req)) {
      res.writeHead(401,{"www-authenticate":"Basic realm=\"WIS Command Center\"","content-type":"application/json; charset=utf-8","cache-control":"no-store"});
      return res.end(JSON.stringify({error:"AUTH_REQUIRED"}));
    }
    if(url.pathname==="/api/dashboard"&&req.method==="GET") return json(res,200,await dashboardPayload());
    if(url.pathname==="/api/whatsapp/status"&&req.method==="GET") {
      const config=await whatsappProviderConfig();
      if(!config) return json(res,200,{configured:false,connected:false,identityVerified:false,outboundEnabled:false,account:"•••• 5679"});
      try {
        const provider=await whatsappProviderGet("connections");
        const connection=Array.isArray(provider.data)?provider.data.find(row=>row.id==="wis-5679")||provider.data[0]:provider.data;
        return json(res,200,{
          configured:true,
          connected:connection?.status==="connected",
          identityVerified:connection?.identity_verified===true,
          outboundEnabled:connection?.outbound_enabled===true,
          account:connection?.phone?`•••• ${String(connection.phone).slice(-4)}`:"•••• 5679",
          updatedAt:connection?.updated_at||null,
          source:provider.source
        });
      } catch(error) {
        return json(res,200,{configured:true,connected:false,identityVerified:false,outboundEnabled:false,account:"•••• 5679",error:error.message});
      }
    }
    if(url.pathname==="/api/whatsapp/conversations"&&req.method==="GET") {
      const result=await whatsappProviderGet("conversations",{q:url.searchParams.get("q"),limit:url.searchParams.get("limit"),offset:url.searchParams.get("offset")});
      return json(res,200,{ok:true,...result});
    }
    if(url.pathname==="/api/whatsapp/messages"&&req.method==="GET") {
      const result=await whatsappProviderGet("messages",{conversation_id:url.searchParams.get("conversationId"),limit:url.searchParams.get("limit"),offset:url.searchParams.get("offset"),sort:"asc",normal_types:"true"});
      return json(res,200,{ok:true,...result});
    }
    if(url.pathname==="/api/sync"&&req.method==="POST") {
      assertMutationRequest(req);
      const result=await syncFromProxy();
      return json(res,result.status,result.body);
    }
    if(url.pathname==="/api/snapshots/sheets"&&req.method==="POST") {
      if(!isLocalRequest(req)) throw Object.assign(new Error("LOCAL_ONLY"),{status:403});
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
      assertMutationRequest(req);
      const result=await processSend(await requestBody(req));
      return json(res,result.status,result.body);
    }
    if(url.pathname==="/api/outreach/draft"&&req.method==="POST") {
      assertMutationRequest(req);
      const input=await requestBody(req);
      const channel=String(input.channel||"").toUpperCase();
      if(!["EMAIL","WHATSAPP"].includes(channel)) return json(res,400,{ok:false,error:"CHANNEL_INVALID"});
      const rowNumber=Number(input.rowNumber);
      const message=String(input.message||"").trim();
      if(!message) return json(res,400,{ok:false,error:"MESSAGE_REQUIRED"});
      const payload=await dashboardPayload();
      const prospect=payload.prospects.find(row=>row.rowNumber===rowNumber);
      if(!prospect) return json(res,404,{ok:false,error:"PROSPECT_NOT_FOUND"});
      const recipient=channel==="EMAIL"?prospect.email:prospect.whatsapp;
      if(!recipient) return json(res,400,{ok:false,error:"RECIPIENT_MISSING"});
      if(!sheetsWriteConfigured()) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      const draftStorage=await updateProspectMessage(rowNumber,channel,message);
      const snapshot=await readJson(sheetSnapshotPath,{});
      const cached=(snapshot.prospects||[]).find(row=>Number(row.rowNumber)===rowNumber);
      if(cached) {
        if(channel==="EMAIL") cached.emailMessage=message;
        else cached.whatsappMessage=message;
        snapshot.fetchedAt=new Date().toISOString();
        await writeJsonAtomic(sheetSnapshotPath,snapshot);
      }
      const savedAt=new Date().toISOString();
      let eventLogged=true;
      try { await appendEvent({messageId:`DRAFT-${rowNumber}-${channel}`,rowNumber,empresa:prospect.empresa,channel,recipient,eventType:"DRAFT_SAVED",fromStatus:"BORRADOR",toStatus:"BORRADOR",detail:"Borrador actualizado desde el dashboard",actor:"human-dashboard",source:"DASHBOARD",evidence:`message_sha256=${hash(message)}`}); }
      catch { eventLogged=false; }
      return json(res,200,{ok:true,rowNumber,channel,savedAt,messageHash:hash(message),eventLogged,draftStorage});
    }
    if(url.pathname==="/api/research/request"&&req.method==="POST") {
      assertMutationRequest(req);
      const request=normalizeResearchRequest(await requestBody(req));
      const requestHash=hash(JSON.stringify(request)).slice(0,20);
      const idempotencyKey=`REQUEST_RESEARCH:${new Date().toISOString().slice(0,10)}:${requestHash}`;
      const liveSnapshot=sheetsLiveConfigured()?await refreshLiveSheets(true):await readJson(sheetSnapshotPath,{});
      const existingSheet=(liveSnapshot?.commands||[]).find(item=>(item.idempotency_key||item.idempotencyKey)===idempotencyKey);
      const existingLocal=(await readNdjson(commandsPath,100)).find(item=>item.idempotencyKey===idempotencyKey);
      const existing=existingSheet||existingLocal;
      if(existing) return json(res,200,{ok:true,command:existing,request,deduplicated:true});
      const scope=`${request.quantity} ${request.businessType} · ${request.industry} · ${request.location} · ${request.employeeSize} empleados`.slice(0,120);
      const command={
        commandId:`CMD-${Date.now()}-${randomUUID().slice(0,8)}`,
        createdAt:new Date().toISOString(),
        action:"REQUEST_RESEARCH",
        scope,
        source:"WIS_DASHBOARD",
        requestedBy:"human-dashboard",
        status:"NEW",
        idempotencyKey,
        evidence:JSON.stringify({schemaVersion:2,...request,progress:{completed:0,total:request.quantity}})
      };
      if(sheetsWriteConfigured()) await appendTaskCommand(command);
      else if(!isLocalRequest(req)) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      try { await appendFile(commandsPath,`${JSON.stringify(command)}\n`,"utf8"); }
      catch(error) { if(!sheetsWriteConfigured()) throw error; }
      return json(res,202,{ok:true,command,request,deduplicated:false});
    }
    if(url.pathname==="/api/actions"&&req.method==="POST") {
      assertMutationRequest(req);
      const input=await requestBody(req);
      if(!allowedActions.has(input.action)) return json(res,400,{ok:false,error:"ACTION_NOT_ALLOWED"});
      const idempotencyKey=String(input.idempotencyKey||`${input.action}:${new Date().toISOString().slice(0,16)}`).slice(0,180);
      const liveSnapshot=sheetsLiveConfigured()?await refreshLiveSheets(true):await readJson(sheetSnapshotPath,{});
      const existingSheet=(liveSnapshot?.commands||[]).find(item=>(item.idempotency_key||item.idempotencyKey)===idempotencyKey);
      const existingLocal=(await readNdjson(commandsPath,100)).find(item=>item.idempotencyKey===idempotencyKey);
      const existing=existingSheet||existingLocal;
      if(existing) return json(res,200,{ok:true,command:existing,deduplicated:true});
      const command={commandId:`CMD-${Date.now()}-${randomUUID().slice(0,8)}`,createdAt:new Date().toISOString(),action:input.action,scope:String(input.scope||"NEXT_PENDING_BATCH").slice(0,120),source:"WIS_DASHBOARD",requestedBy:"human-dashboard",status:"NEW",idempotencyKey,evidence:"Comando creado desde el panel autenticado; pendiente de ejecutor"};
      if(sheetsWriteConfigured()) await appendTaskCommand(command);
      else if(!isLocalRequest(req)) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      try { await appendFile(commandsPath,`${JSON.stringify(command)}\n`,"utf8"); }
      catch(error) { if(!sheetsWriteConfigured()) throw error; }
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
if(isMain) server.listen(port,bindHost,()=>process.stdout.write(`WIS Command Center: http://${bindHost}:${port}/#prospects\n`));

export { acquireSendLocks, approvalGate, assertMutationRequest, channelHealth, channelLimitGate, dashboardAuthorized, explicitE164, normalizeProspect, normalizeResearchRequest, prospectStopGate, refreshLiveSheets, server, whatsappOptInGate, whatsappProviderConfig, whatsappQuery };
