import { createServer } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendOutreachEvent,
  appendOutreachQueue,
  appendCommercialProspects,
  appendCostUsage,
  appendResearchEvidence,
  appendTaskCommand,
  buildLiveSnapshot,
  COMMERCIAL_SHEETS,
  sheetsLiveConfigured,
  sheetsWriteConfigured,
  updateOutreachQueue,
  updateProspectMessage,
  updateTaskCommandStatus,
  upsertCostSetting
} from "./sheets-live.mjs";
import { buildCostAnalytics, estimateScenario, normalizeCostRecord, normalizeCostSettings, PRICING, PRICING_VERSION } from "./costs.mjs";
import { buildZeroCostGuard, HOTEL_CAMPAIGN, HOTEL_CAMPAIGN_ID, HOTEL_SHEET, HOTEL_LATAM_CAMPAIGN_ID, HOTEL_LATAM_SHEET, hotelCampaignProfile } from "./hotel-research.mjs";
import { runHotelResearchBatch } from "./hotel-research-worker.mjs";

const standaloneRoot=process.env.WIS_STANDALONE_ROOT?resolve(process.env.WIS_STANDALONE_ROOT):null;
const root = standaloneRoot||fileURLToPath(new URL("../../../..", import.meta.url));
const publicDir = standaloneRoot?join(root,"out"):join(root, "ops", "reports", "web", "wis-operations-dashboard", "out");
const configDir = standaloneRoot?join(root,"config"):join(root, "ops", "config");
const runtimeDir = standaloneRoot?join(root,"runtime"):join(root, "ops", "runtime");
const commandsPath = join(runtimeDir, "dashboard-commands.ndjson");
const sheetSnapshotPath = join(runtimeDir, "dashboard-sheet-snapshot.json");
const outreachEventsPath = join(runtimeDir, "dashboard-outreach-events.ndjson");
const costUsagePath = join(runtimeDir, "dashboard-cost-usage.ndjson");
const statePath = join(configDir, "dashboard-state.json");
const channelVerificationPath = join(configDir, "channel-verification.json");
const port = Number(process.env.PORT || process.env.WIS_DASHBOARD_PORT || 4174);
const bindHost = process.env.WIS_BIND_HOST || "127.0.0.1";
const pipelineControlActions = new Set(["PIPELINE_ACTIVATE", "PIPELINE_PAUSE", "PIPELINE_RESUME", "PIPELINE_PANIC_STOP", "PIPELINE_UPDATE_CONFIG"]);
const allowedActions = new Set(["CONTINUE_RESEARCH", "PAUSE_RESEARCH", "RETRY_BLOCKED_RESEARCH", "RUN_QA", "REFRESH_SNAPSHOT", "PREPARE_DRAFTS", "EVALUATE_APOLLO"]);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" };
const activeSendLocks = new Set();
const activeResearchRuns = new Map();
const pausedResearchCampaigns = new Set();
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

function sendSnapshotGate(snapshot,now=Date.now(),configuredMaxAgeSeconds=process.env.WIS_SEND_SNAPSHOT_MAX_AGE_SECONDS) {
  const configured=Number(configuredMaxAgeSeconds||120);
  const maxAgeMs=(Number.isFinite(configured)?Math.max(30,configured):120)*1000;
  const fetchedAt=Date.parse(snapshot?.fetchedAt||"");
  if(!Number.isFinite(fetchedAt)||fetchedAt>now+30_000||now-fetchedAt>maxAgeMs) return {eligible:false,reason:"SEND_SNAPSHOT_STALE"};
  return {eligible:true};
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
  const sourceSheet=String(row.sourceSheet||"Distribuidoras_300").trim();
  return {
    prospectId:String(row.prospectId||`${sourceSheet}:${row.rowNumber||index+2}`),
    prospectKey:String(row.prospectKey||"").trim(),
    sourceSheet,
    campaignId:String(row.campaignId||COMMERCIAL_SHEETS[sourceSheet]?.campaignId||"distribuidoras-300"),
    phase:String(row.phase||COMMERCIAL_SHEETS[sourceSheet]?.phase||"outreach"),
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
  if(row.phase==="contacts") return Boolean(row.empresa&&(row.email||row.whatsapp));
  return /^\s*\d+\s*\/\s*\d+/.test(row.reviewsAnalyzed)&&Boolean(row.analysis&&row.problems&&(row.emailMessage||row.whatsappMessage));
}

function prospectKeyFor(prospect) {
  if(prospect.prospectKey) return prospect.prospectKey;
  return `${String(prospect.sourceSheet||"Distribuidoras_300").toLowerCase().replace(/_/g,"-")}-row-${prospect.rowNumber}`;
}

function sameProspect(row,prospect) {
  const rowSheet=String(row.sourceSheet||row.source_sheet||"Distribuidoras_300");
  return Number(row.rowNumber||row.source_row)===prospect.rowNumber&&rowSheet===String(prospect.sourceSheet||"Distribuidoras_300");
}

function acquireSendLocks(lockKeys) {
  const keys=[...new Set(lockKeys)].sort();
  if(keys.some(lockKey=>activeSendLocks.has(lockKey))) return null;
  keys.forEach(lockKey=>activeSendLocks.add(lockKey));
  return ()=>keys.forEach(lockKey=>activeSendLocks.delete(lockKey));
}

function approvalGate(snapshot, prospect, channel) {
  if(prospect.phase==="contacts") return {eligible:false,reason:"HOTEL_CONTACTS_ONLY"};
  const qa=(snapshot.qa||[]).find(row=>sameProspect(row,prospect));
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
    Array.isArray(row.prospectKeys)&&row.prospectKeys[row.prospectRows.indexOf(prospect.rowNumber)]===qa.prospectKey &&
    (!prospect.prospectKey||row.prospectKeys[row.prospectRows.indexOf(prospect.rowNumber)]===prospect.prospectKey) &&
    Array.isArray(row.recipients)&&key(row.recipients[row.prospectRows.indexOf(prospect.rowNumber)])===key(prospect.empresa) &&
    (channel!=="EMAIL"||(Array.isArray(row.recipientEmails)&&key(row.recipientEmails[row.prospectRows.indexOf(prospect.rowNumber)])===key(prospect.email))) &&
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
  const prospectKey=qa.prospectKey||prospectKeyFor(prospect);
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
    approvedAt:approval.decidedAt,
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
  const promptKey=key(prompt);
  let businessType=cleanText(input.businessType,40).toLowerCase();
  if(!businessType) businessType=promptKey.includes("hotel")?"hoteles":promptKey.includes("logistic")?"logisticas":promptKey.includes("distribuidor")?"distribuidoras":promptKey.includes("proveedor")?"proveedores":"empresas";
  if(!["distribuidoras","logisticas","hoteles","proveedores","empresas","otro"].includes(businessType)) businessType="otro";
  const hotelCampaign=businessType==="hoteles"||[HOTEL_CAMPAIGN_ID,HOTEL_LATAM_CAMPAIGN_ID].includes(input.campaignId)||[HOTEL_SHEET,HOTEL_LATAM_SHEET].includes(input.destination);
  const hotelProfile=hotelCampaignProfile(input);
  const quantityLimit=hotelProfile.campaignId===HOTEL_LATAM_CAMPAIGN_ID?500:300;
  const quantity=Math.max(1,Math.min(quantityLimit,Number(input.quantity||inferredQuantity||25)));
  const knownCountries=["Argentina","Chile","Uruguay","Paraguay","Bolivia","Perú","Colombia","México","Brasil","Ecuador"];
  const promptCountry=knownCountries.find(country=>promptKey.includes(key(country)))||"";
  let industry=cleanText(input.industry,90);
  if(!industry&&prompt) {
    const match=prompt.match(/(?:hoteles?|hoster[ií]as?|apart\s+hoteles?|distribuidoras?|log[ií]sticas?|proveedores?|empresas?)\s+(?:de|del\s+rubro\s+)?([^,.]+?)(?=\s+(?:en|con|incluyendo|junto)\b|$)/iu);
    industry=cleanText(match?.[1],90);
  }
  if(hotelCampaign) industry="Hotelería y alojamiento";
  if(industry&&(promptCountry&&key(industry).includes(key(promptCountry))||/\bempleados?\b/i.test(industry))) {
    industry=businessType==="hoteles"?"Hotelería y alojamiento":businessType==="logisticas"?"Logística y transporte":businessType==="distribuidoras"?"Distribución general":"Servicios B2B";
  }
  const country=hotelCampaign?hotelProfile.country:cleanText(input.country,60)||promptCountry;
  const region=cleanText(input.region,80);
  let location=cleanText(input.location,90);
  if(!location&&prompt) {
    const match=prompt.match(/\ben\s+([^,.]+?)(?=\s+(?:con|incluyendo|junto|y\s+analiz)\b|$)/iu);
    location=cleanText(match?.[1],90);
  }
  location=region&&country?`${region}, ${country}`:region||country||location||"Argentina";
  const reviews=hotelCampaign?"none":input.reviews==="none"?"none":"1-3";
  const contact=hotelCampaign?"both":["email","whatsapp","both"].includes(input.contact)?input.contact:"both";
  const inferredEmployeeSize=prompt.match(/\b(1-10|11-20|11-50|20-50|51-200|201-500)\s+empleados?\b/i)?.[1];
  const employeeSize=hotelCampaign?"professional":["any","1-10","11-20","11-50","20-50","51-200","201-500"].includes(input.employeeSize)?input.employeeSize:(inferredEmployeeSize||"11-50");
  const minimumReviews=hotelCampaign?20:[0,5,10,20,50,100].includes(Number(input.minimumReviews))?Number(input.minimumReviews):10;
  const destination=hotelCampaign?hotelProfile.destination:["Distribuidoras_300","Logisticas_LATAM","Prospectos_Custom"].includes(input.destination)?input.destination:(businessType==="logisticas"?"Logisticas_LATAM":"Distribuidoras_300");
  const priority=["NORMAL","HIGH","URGENT"].includes(input.priority)?input.priority:"NORMAL";
  const businessLabel={distribuidoras:"distribuidoras",logisticas:"logísticas",hoteles:"hoteles independientes",proveedores:"proveedores B2B",empresas:"empresas de servicios",otro:"empresas"}[businessType];
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
    minimumReviews:hotelCampaign?minimumReviews:reviews==="none"?0:minimumReviews,
    excludeLargeCorporations:input.excludeLargeCorporations!==false,
    destination,
    priority,
    batchName,
    campaignId:hotelCampaign?hotelProfile.campaignId:cleanText(input.campaignId,80),
    phase:hotelCampaign?"contacts":cleanText(input.phase||"full",30),
    professionalOperation:hotelCampaign||input.professionalOperation===true,
    zeroCostMode:hotelCampaign||input.zeroCostMode===true,
    reviews,
    contact,
    objective,
    prompt,
    reviewRule:reviews==="1-3"?"Analizar sólo reseñas de 1, 2 y 3 estrellas e informar analizadas/total accesible":"Sin análisis de reseñas",
    outreachRule:hotelCampaign?"Fase de contactos: no redactar ni enviar mensajes":"Preparar borradores; no enviar sin QA y aprobación"
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
    executor:{
      connected:process.env.WIS_RESEARCH_EXECUTOR_ENABLED==="true",
      label:process.env.WIS_RESEARCH_EXECUTOR_ENABLED==="true"?"Ejecutor conectado · costo cero obligatorio":"Ejecutor preparado · activación pendiente"
    }
  };
}

const defaultPipelineConfig=Object.freeze({
  schemaVersion:1,
  intervalMinutes:10,
  batchSize:25,
  maxSpecialists:3,
  autoResearch:true,
  autoCopy:true,
  autoQa:true,
  emailMode:"APPROVAL_REQUIRED",
  whatsappMode:"OPTIN_AND_APPROVAL_REQUIRED",
  dryRun:true
});

function commandEvidence(row={}) {
  if(row.evidence&&typeof row.evidence==="object") return row.evidence;
  try { return JSON.parse(row.evidence||"{}"); } catch { return {}; }
}

function normalizePipelineConfig(input={},base=defaultPipelineConfig) {
  const intervalMinutes=Math.max(10,Math.min(1440,Math.round(Number(input.intervalMinutes??base.intervalMinutes)||10)));
  const batchSize=Math.max(1,Math.min(25,Math.round(Number(input.batchSize??base.batchSize)||25)));
  const maxSpecialists=Math.max(1,Math.min(3,Math.round(Number(input.maxSpecialists??base.maxSpecialists)||3)));
  return {
    schemaVersion:1,
    intervalMinutes,
    batchSize,
    maxSpecialists,
    autoResearch:input.autoResearch===undefined?base.autoResearch:input.autoResearch===true,
    autoCopy:input.autoCopy===undefined?base.autoCopy:input.autoCopy===true,
    autoQa:input.autoQa===undefined?base.autoQa:input.autoQa===true,
    emailMode:"APPROVAL_REQUIRED",
    whatsappMode:"OPTIN_AND_APPROVAL_REQUIRED",
    dryRun:input.dryRun===undefined?base.dryRun:input.dryRun!==false
  };
}

function normalizeCommand(row={}) {
  const evidence=commandEvidence(row);
  return {
    commandId:cleanText(row.commandId||row.command_id,100),
    createdAt:cleanText(row.createdAt||row.created_at,60),
    updatedAt:cleanText(row.updatedAt||row.updated_at||row.createdAt||row.created_at,60),
    action:cleanText(row.action,60).toUpperCase(),
    scope:cleanText(row.scope,180),
    status:cleanText(row.status||"NEW",40).toUpperCase()||"NEW",
    idempotencyKey:cleanText(row.idempotencyKey||row.idempotency_key,200),
    evidence,
    leaseOwner:cleanText(row.leaseOwner||row.lease_owner||evidence.leaseOwner||evidence.lease_owner,100),
    leaseExpiresAt:cleanText(row.leaseExpiresAt||row.lease_expires_at||evidence.leaseExpiresAt||evidence.lease_expires_at,60),
    attempt:Math.max(0,Number(row.attempt||row.attempts||evidence.attempt||evidence.attempts||0)),
    progress:evidence.progress||row.progress||null,
    error:cleanText(row.error||row.last_error||evidence.error||evidence.lastError,240)
  };
}

function commandIdentity(row) {
  return row.idempotencyKey||row.commandId||`${row.action}:${row.createdAt}`;
}

function pipelineAutomationState(sheetCommands=[],localCommands=[],runs=[],snapshot={}) {
  const commandMap=new Map();
  for(const raw of [...sheetCommands,...localCommands]) {
    const row=normalizeCommand(raw);
    const identity=commandIdentity(row);
    if(!identity) continue;
    const current=commandMap.get(identity);
    if(!current||String(row.updatedAt||row.createdAt).localeCompare(String(current.updatedAt||current.createdAt))>=0) commandMap.set(identity,row);
  }
  const commands=[...commandMap.values()];
  commands.sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));
  const controls=commands.filter(row=>pipelineControlActions.has(row.action));
  let config={...defaultPipelineConfig};
  for(const row of controls.slice().reverse()) config=normalizePipelineConfig(row.evidence?.config||row.evidence,config);
  const latest=controls[0]||null;
  const stateByAction={PIPELINE_ACTIVATE:"ACTIVE",PIPELINE_RESUME:"ACTIVE",PIPELINE_PAUSE:"PAUSED",PIPELINE_PANIC_STOP:"PANIC_STOPPED"};
  const latestLifecycle=controls.find(row=>row.action!=="PIPELINE_UPDATE_CONFIG")||null;
  const status=stateByAction[latestLifecycle?.action]||"INACTIVE";
  const heartbeatCommands=commands.filter(row=>["PIPELINE_HEARTBEAT","DISPATCHER_HEARTBEAT","HEARTBEAT_PULSE"].includes(row.action));
  const latestRun=(runs||[]).map(row=>({
    at:row.updated_at||row.updatedAt||row.ended_at||row.endedAt||row.started_at||row.startedAt||row.timestamp,
    status:String(row.status||"").toUpperCase(),
    agent:row.agent||row.owner||row.role
  })).filter(row=>row.at&&/dispatcher|orchestrator|heartbeat/i.test(row.agent||"")).sort((a,b)=>String(b.at).localeCompare(String(a.at)))[0];
  const heartbeatAt=heartbeatCommands[0]?.updatedAt||heartbeatCommands[0]?.createdAt||latestRun?.at||null;
  const heartbeatAge=heartbeatAt&&Number.isFinite(Date.parse(heartbeatAt))?Date.now()-Date.parse(heartbeatAt):Infinity;
  const executorConnected=heartbeatAge<=Math.max(config.intervalMinutes*2+5,25)*60_000;
  const pendingCommands=commands.filter(row=>row.status==="NEW").length;
  const activeCommands=commands.filter(row=>row.status==="IN_PROGRESS").length;
  const waitingApproval=commands.filter(row=>row.status==="WAITING_APPROVAL").length;
  const researchRows=commands.filter(row=>["REQUEST_RESEARCH","CONTINUE_RESEARCH"].includes(row.action));
  const copyRows=commands.filter(row=>/COPY|DRAFT/.test(row.action));
  const qaRows=commands.filter(row=>/QA/.test(row.action));
  const laneStatus=rows=>rows.some(row=>row.status==="IN_PROGRESS")?"WORKING":rows.some(row=>row.status==="NEW")?"QUEUED":rows.some(row=>row.status==="BLOCKED")?"BLOCKED":rows.length?"READY":"IDLE";
  const activeApprovals=(snapshot.approvals||[]).filter(row=>row.decision==="APPROVED"&&Date.parse(row.expiresAt)>Date.now());
  const qaPassed=(snapshot.qa||[]).filter(row=>row.status==="PASSED").length;
  const verifiedOptIns=(snapshot.optIns||[]).filter(row=>row.verified===true&&row.reconciled===true&&row.direction==="INBOUND").length;
  return {
    status,
    active:status==="ACTIVE",
    latestControl:latest,
    latestLifecycle,
    config,
    executor:{
      connected:executorConnected,
      label:executorConnected?"Heartbeat conectado":"Heartbeat sin señal reciente",
      heartbeatAt,
      detail:executorConnected?"El ejecutor puede reclamar comandos pendientes.":"Los comandos quedan guardados; no se afirma ejecución hasta recibir un heartbeat."
    },
    counters:{pendingCommands,activeCommands,waitingApproval,qaPassed,activeApprovals:activeApprovals.length,verifiedOptIns},
    lanes:[
      {id:"orchestrator",label:"Orquestador",status:status==="PANIC_STOPPED"?"STOPPED":status==="PAUSED"?"PAUSED":executorConnected&&status==="ACTIVE"?"WORKING":status==="ACTIVE"?"WAITING_HEARTBEAT":"IDLE",detail:executorConnected?`Heartbeat ${new Date(heartbeatAt).toLocaleString("es-AR")}`:"Esperando señal durable"},
      {id:"research",label:"Research",status:laneStatus(researchRows),detail:`${researchRows.filter(row=>row.status==="NEW").length} pedidos pendientes`},
      {id:"copy",label:"Redacción",status:laneStatus(copyRows),detail:`${copyRows.filter(row=>row.status==="NEW").length} lotes pendientes`},
      {id:"qa",label:"QA independiente",status:laneStatus(qaRows),detail:`${qaPassed} registros aprobados`},
      {id:"email",label:"Email",status:activeApprovals.length?"WAITING_APPROVAL":"LOCKED",detail:"Aprobación exacta + idempotencia obligatorias"},
      {id:"whatsapp",label:"WhatsApp",status:verifiedOptIns?"WAITING_APPROVAL":"LOCKED",detail:`${verifiedOptIns} opt-in verificables · email primero`}
    ],
    commandQueue:commands.filter(row=>["NEW","IN_PROGRESS","READY"].includes(row.status)).slice(0,200),
    recentCommands:commands.slice(0,12).map(({evidence,...row})=>({...row,config:evidence?.config||null})),
    gates:{
      externalSendsBlocked:true,
      email:"QA independiente + aprobación de lote + destinatario verificable + sin duplicado",
      whatsapp:"Email previo + opt-in inbound reconciliado + ventana 24 h + aprobación de lote",
      note:"Estos controles sólo escriben comandos durables. Ningún botón ejecuta un envío externo."
    }
  };
}

function whatsappOptInGate(snapshot, prospect, now=new Date()) {
  const qa=(snapshot.qa||[]).find(row=>sameProspect(row,prospect));
  const prospectKey=qa?.prospectKey||prospectKeyFor(prospect);
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
  return (event.source==="DASHBOARD"&&sameProspect(event,prospect))||
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
  const emailApprovalAllowlist=String(process.env.WIS_EMAIL_ALLOWED_APPROVAL_IDS||"").split(",").map(value=>value.trim()).filter(Boolean);
  const emailOutboundEnabled=process.env.WIS_EMAIL_OUTBOUND_ENABLED==="true";
  const whatsappPaused=verification.whatsapp?.outboundPaused!==undefined?verification.whatsapp.outboundPaused!==false:process.env.WIS_WHATSAPP_OUTBOUND_PAUSED!=="false";
  return {
    email:{
      provider:process.env.BREVO_API_KEY?"Brevo transactional":"Gmail / Brevo",
      account:"Ortu - WIS <ortu@wis-agency.com>",
      canSend:emailConfigured&&emailConnected&&signatureApproved&&emailApprovalAllowlist.length>0&&emailOutboundEnabled,
      configured:emailConfigured,
      connected:emailConnected,
      detail:!emailConnected?"Falta verificar el alias y el remitente predeterminado.":!signatureApproved?"Alias verificado; falta aprobar y cargar la firma HTML WIS.":!emailConfigured?"Alias y firma verificados; falta el webhook exclusivo de envío.":!emailApprovalAllowlist.length?"Brevo conectado; falta una lista blanca de aprobaciones.":emailOutboundEnabled?"Brevo habilitado sólo para las aprobaciones incluidas en la lista blanca.":"Brevo conectado; la salida permanece pausada."
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

function emailApprovalAllowed(approvalId) {
  const allowed=String(process.env.WIS_EMAIL_ALLOWED_APPROVAL_IDS||"").split(",").map(value=>value.trim()).filter(Boolean);
  return allowed.includes(String(approvalId||""));
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

function googleProviderUsageSnapshot() {
  return {
    observedAt:process.env.WIS_GOOGLE_USAGE_OBSERVED_AT||"",
    "places-text-search-pro":Number(process.env.WIS_GOOGLE_USAGE_TEXT_SEARCH_PRO||0),
    "place-details-enterprise":Number(process.env.WIS_GOOGLE_USAGE_PLACE_DETAILS_ENTERPRISE||0)
  };
}

async function dashboardPayload({refresh=true}={}) {
  if(refresh) try { await refreshLiveSheets(false); } catch { /* keep the last valid snapshot and surface degraded sync below */ }
  const [snapshot,state,localEvents,localCommands,verification,localCosts]=await Promise.all([
    readJson(sheetSnapshotPath,{fetchedAt:null,source:"NONE",prospects:[],events:[]}),
    readJson(statePath,{}),
    readNdjson(outreachEventsPath,500),
    readNdjson(commandsPath,200),
    readJson(channelVerificationPath,{}),
    readNdjson(costUsagePath,2000)
  ]);
  const prospects=(snapshot.prospects||[]).map(normalizeProspect);
  const queue=Array.isArray(snapshot.outreachQueue)?snapshot.outreachQueue:[];
  const events=[...localEvents,...(snapshot.events||[])].sort((a,b)=>String(b.timestamp||"").localeCompare(String(a.timestamp||"")));
  const sentEvents=events.filter(row=>isSuccessfulSend(row)||/RESPONDIDO/i.test(row.eventType||row.status||""));
  const contactedRows=new Set();
  for(const prospect of prospects) {
    const matched=sentEvents.some(event=>(event.source==="DASHBOARD"&&sameProspect(event,prospect)) ||
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
  const automation=pipelineAutomationState(snapshot.commands||[],localCommands,snapshot.runs||[],snapshot);
  const costRows=[...(snapshot.costLedger||[]),...localCosts];
  const uniqueCosts=[];
  const seenCosts=new Set();
  for(const row of costRows) {
    const identity=row.usageId||row.usage_id||row.idempotencyKey||row.idempotency_key;
    if(identity&&seenCosts.has(identity)) continue;
    if(identity) seenCosts.add(identity);
    uniqueCosts.push(row);
  }
  const meetings=events.filter(row=>/MEETING|REUNION/i.test(row.eventType||row.status||"")).length;
  const costSettings=normalizeCostSettings(snapshot.costSettings||[],process.env);
  const costs=buildCostAnalytics(uniqueCosts,costSettings,{qualified:prospects.filter(candidateReady).length,replies,meetings});
  costs.zeroCostHotels=buildZeroCostGuard(uniqueCosts,googleProviderUsageSnapshot());
  const prospectsBySheet=Object.fromEntries(Object.keys(COMMERCIAL_SHEETS).map(sourceSheet=>[sourceSheet,prospects.filter(row=>row.sourceSheet===sourceSheet).length]));
  return {
    generatedAt:new Date().toISOString(),
    prospects,
    queue,
    events:events.slice(0,500),
    research,
    automation,
    costs,
    stats:{
      prospects:prospects.length,
      prospectsBySheet,
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
      detail:snapshot.fetchedAt?`${prospects.length} filas leídas de ${Object.entries(prospectsBySheet).map(([sheet,count])=>`${sheet}: ${count}`).join(" · ")}.`:"Todavía no existe un snapshot de Google Sheets."
    }
  };
}

function sendContextFromData(snapshot,localEvents,verification,{sourceSheet,rowNumber}) {
  const rawProspect=(snapshot.prospects||[]).find(row=>
    Number(row.rowNumber)===Number(rowNumber)&&String(row.sourceSheet||"Distribuidoras_300")===String(sourceSheet)
  );
  return {
    prospect:rawProspect?normalizeProspect(rawProspect):null,
    events:[...(localEvents||[]),...(snapshot.events||[])],
    health:channelHealth(verification)
  };
}

async function sendContext(snapshot,selection) {
  const [localEvents,verification]=await Promise.all([
    readNdjson(outreachEventsPath,500),
    readJson(channelVerificationPath,{})
  ]);
  return sendContextFromData(snapshot,localEvents,verification,selection);
}

async function appendEvent(event) {
  const complete={eventId:`EVT-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),...event};
  if(sheetsWriteConfigured()) await appendOutreachEvent(complete);
  try { await appendFile(outreachEventsPath,`${JSON.stringify(complete)}\n`,"utf8"); }
  catch(error) { if(!sheetsWriteConfigured()) throw error; }
  return complete;
}

async function recordCostUsage(input={}) {
  const record=normalizeCostRecord({...input,usageId:input.usageId||`COST-${Date.now()}-${randomUUID().slice(0,8)}`});
  const local=await readNdjson(costUsagePath,2000);
  if(record.idempotencyKey&&local.some(row=>row.idempotencyKey===record.idempotencyKey)) return {...local.find(row=>row.idempotencyKey===record.idempotencyKey),deduplicated:true};
  if(sheetsWriteConfigured()) await appendCostUsage(record);
  try { await appendFile(costUsagePath,`${JSON.stringify(record)}\n`,"utf8"); }
  catch(error) { if(!sheetsWriteConfigured()) throw error; }
  return record;
}

async function startHotelResearch(command,request) {
  const profile=hotelCampaignProfile(request);
  const researchLockKey=profile.campaignId;
  if(activeResearchRuns.has(researchLockKey)) return activeResearchRuns.get(researchLockKey);
  const run=(async()=>{
    const cleanRequest={...request};
    delete cleanRequest.error;
    try {
      let lastResult={status:"BLOCKED",reason:"NOT_STARTED",rows:[]};
      while(true) {
        const snapshot=await refreshLiveSheets(true)||await readJson(sheetSnapshotPath,{});
        const existingProspects=(snapshot?.prospects||[]).filter(row=>row.sourceSheet===profile.destination);
        const total=Number(cleanRequest.quantity||profile.target);
        const progress={completed:existingProspects.length,total};
        if(progress.completed>=total) {
          await updateTaskCommandStatus(command.commandId,"DONE",{schemaVersion:3,...cleanRequest,progress,lastBatch:{rows:0,status:"DONE",reason:"CAMPAIGN_TARGET_REACHED"},costGuard:{status:"CONFIRMED_ZERO",reason:"WITHIN_FREE_QUOTA"}});
          return {status:"DONE",reason:"CAMPAIGN_TARGET_REACHED",rows:[]};
        }
        if(pausedResearchCampaigns.has(profile.campaignId)) {
          await updateTaskCommandStatus(command.commandId,"BLOCKED",{schemaVersion:3,...cleanRequest,progress,lastBatch:{rows:0,status:"BLOCKED",reason:"PAUSED_BY_USER"}});
          return {status:"BLOCKED",reason:"PAUSED_BY_USER",rows:[]};
        }
        const localCosts=await readNdjson(costUsagePath,2000);
        const mergedCosts=new Map();
        for(const row of [...(snapshot?.costLedger||[]),...localCosts]) {
          const key=row.usageId||row.usage_id||row.idempotencyKey||row.idempotency_key||`${row.timestamp}:${row.operationId||row.operation_id}`;
          if(!mergedCosts.has(key)) mergedCosts.set(key,row);
        }
        const guard=buildZeroCostGuard([...mergedCosts.values()],googleProviderUsageSnapshot(),new Date(),profile.campaignId);
        const batchId=`${command.commandId}-LOT-${Math.floor(progress.completed/25)+1}`;
        await updateTaskCommandStatus(command.commandId,"IN_PROGRESS",{schemaVersion:3,...cleanRequest,progress,costGuard:{status:guard.status,reason:guard.reason},activeBatch:batchId});
        const result=await runHotelResearchBatch({
          commandId:command.commandId,
          request:{...cleanRequest,batchSize:Math.min(25,total-progress.completed),batchId},
          existingProspects,
          guard,
          shouldStop:()=>pausedResearchCampaigns.has(profile.campaignId),
          reserveCost:(service,metadata)=>recordCostUsage({operationId:`${command.commandId}:${service}:${randomUUID().slice(0,8)}`,idempotencyKey:`COST:${command.commandId}:${metadata.batchId||batchId}:${service}:${metadata.placeId||metadata.city||randomUUID()}`,runId:command.commandId,stage:"HOTEL_RESEARCH",provider:"google",service,units:1,unitName:"consulta",providerCostUsd:0,costSource:"PROVIDER_FREE_QUOTA",metadata,recordedBy:"prospect-research"}),
          appendRows:appendCommercialProspects,
          appendEvidence:appendResearchEvidence
        });
        lastResult=result;
        const refreshed=await refreshLiveSheets(true)||snapshot;
        const completed=(refreshed?.prospects||[]).filter(row=>row.sourceSheet===profile.destination).length;
        const rows=result.rows||[];
        const qaPassed=rows.every(row=>Array.isArray(row)&&row.length===12&&row.slice(7).every(value=>!String(value||"").trim())&&Boolean(String(row[1]||"").trim())&&Boolean(String(row[2]||"").trim())&&Boolean(String(row[4]||"").trim())&&Boolean(String(row[6]||"").trim())&&Boolean(String(row[3]||"").trim()||String(row[5]||"").trim()));
        if(rows.length) await appendResearchEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId:command.commandId,campaignId:profile.campaignId,batchId,prospectKey:"",sourceUrl:`https://docs.google.com/spreadsheets/d/${process.env.WIS_COMMERCIAL_SHEET_ID||"1HoVbDf_In8urKkiUnfkE-j3TPq0vrI4pjfPoAYKJYl8"}/edit`,evidenceType:"BATCH_QA",decision:qaPassed?"VALIDATED":"REJECTED",detail:JSON.stringify({rows:rows.length,completed,total,destination:profile.destination,columnsWritten:"A:G",deferredColumnsBlank:qaPassed,providerCostUsd:0,result:qaPassed?"PASS":"FAIL"}),score:qaPassed?100:0,recordedBy:"qa-ops"});
        if(!qaPassed||result.status==="BLOCKED"||!rows.length) {
          const reason=!qaPassed?"BATCH_QA_FAILED":result.reason||"NO_VERIFIED_ROWS";
          await updateTaskCommandStatus(command.commandId,"BLOCKED",{schemaVersion:3,...cleanRequest,progress:{completed,total},lastBatch:{batchId,rows:rows.length,status:result.status,reason},costGuard:{status:guard.status,reason:guard.reason}});
          return {...result,status:"BLOCKED",reason};
        }
        if(completed>=total) {
          await updateTaskCommandStatus(command.commandId,"DONE",{schemaVersion:3,...cleanRequest,progress:{completed,total},lastBatch:{batchId,rows:rows.length,status:"VALIDATED",reason:"CAMPAIGN_TARGET_REACHED"},costGuard:{status:guard.status,reason:guard.reason}});
          return {...result,status:"DONE",reason:"CAMPAIGN_TARGET_REACHED"};
        }
        await updateTaskCommandStatus(command.commandId,"IN_PROGRESS",{schemaVersion:3,...cleanRequest,progress:{completed,total},lastBatch:{batchId,rows:rows.length,status:"VALIDATED",reason:result.reason},costGuard:{status:guard.status,reason:guard.reason}});
        await new Promise(resolve=>setTimeout(resolve,2_000));
      }
    } catch(error) {
      console.error("hotel research failed",{commandId:command.commandId,error:error?.stack||error?.message||String(error)});
      try { await updateTaskCommandStatus(command.commandId,"BLOCKED",{schemaVersion:3,...cleanRequest,error:error.message||"HOTEL_RESEARCH_FAILED"}); } catch { /* preserve root failure */ }
      return {status:"BLOCKED",reason:error.message||"HOTEL_RESEARCH_FAILED",rows:[]};
    } finally { activeResearchRuns.delete(researchLockKey); }
  })();
  activeResearchRuns.set(researchLockKey,run);
  return run;
}

async function postJson(url,payload,headers={}) {
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(25_000)});
  const text=await response.text();
  let parsed={};
  try { parsed=text?JSON.parse(text):{}; } catch { parsed={raw:text.slice(0,500)}; }
  return {ok:response.ok,status:response.status,body:parsed};
}

async function reconcileBrevoRecipient({email,approvedAt}) {
  if(!process.env.BREVO_API_KEY) return {ok:false,error:"EMAIL_PROVIDER_RECONCILIATION_UNAVAILABLE",status:409};
  const url=new URL("https://api.brevo.com/v3/smtp/statistics/events");
  url.searchParams.set("email",email);
  url.searchParams.set("limit","50");
  url.searchParams.set("sort","desc");
  const response=await fetch(url,{headers:{"api-key":process.env.BREVO_API_KEY,accept:"application/json"},signal:AbortSignal.timeout(15_000)});
  let body={};
  try { body=await response.json(); } catch { /* fail closed below */ }
  if(!response.ok||!Array.isArray(body.events)) return {ok:false,error:"EMAIL_PROVIDER_RECONCILIATION_FAILED",status:502};
  const approvedAtMs=Date.parse(approvedAt||"");
  if(!Number.isFinite(approvedAtMs)) return {ok:false,error:"APPROVAL_TIMESTAMP_INVALID",status:409};
  const duplicate=body.events.find(event=>{
    const eventMs=Date.parse(event.date||event.timestamp||"");
    return Number.isFinite(eventMs)&&eventMs>=approvedAtMs&&/delivered|sent|request|deferred|blocked|hardBounces|softBounces|invalid|error/i.test(String(event.event||""));
  });
  if(duplicate) return {ok:false,error:"PROVIDER_DUPLICATE_RECIPIENT",status:409};
  return {ok:true};
}

async function sendEmail({prospect,message,idempotencyKey,approvalId}) {
  const directBrevo=Boolean(process.env.BREVO_API_KEY);
  if(!directBrevo&&(!process.env.WIS_EMAIL_WEBHOOK_URL||!process.env.WIS_EMAIL_WEBHOOK_TOKEN)) return {ok:false,error:"EMAIL_PROVIDER_NOT_CONFIGURED",status:409};
  if(process.env.WIS_EMAIL_OUTBOUND_ENABLED!=="true") return {ok:false,error:"CHANNEL_BLOCKED",status:409};
  if(!emailApprovalAllowed(approvalId)) return {ok:false,error:"EMAIL_APPROVAL_NOT_ALLOWED",status:409};
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
  let stage="VALIDATING_INPUT";
  if(input.confirmed!==true) return {status:400,body:{ok:false,error:"HUMAN_CONFIRMATION_REQUIRED"}};
  const channel=String(input.channel||"").toUpperCase();
  if(!["EMAIL","WHATSAPP"].includes(channel)) return {status:400,body:{ok:false,error:"CHANNEL_INVALID"}};
  let sendSnapshot=await readJson(sheetSnapshotPath,{});
  const snapshotGate=sendSnapshotGate(sendSnapshot);
  if(!snapshotGate.eligible) return {status:409,body:{ok:false,error:snapshotGate.reason}};
  const sourceSheet=String(input.sourceSheet||"Distribuidoras_300");
  let context=await sendContext(sendSnapshot,{sourceSheet,rowNumber:Number(input.rowNumber)});
  const prospect=context.prospect;
  if(!prospect) return {status:404,body:{ok:false,error:"PROSPECT_NOT_FOUND"}};
  if(prospect.phase==="contacts") return {status:409,body:{ok:false,error:"HOTEL_CONTACTS_ONLY"}};
  const recipient=channel==="EMAIL"?prospect.email:prospect.whatsapp;
  if(!recipient) return {status:400,body:{ok:false,error:"RECIPIENT_MISSING"}};
  if(channel==="WHATSAPP"&&!prospect.whatsappE164) return {status:400,body:{ok:false,error:"WHATSAPP_PHONE_INVALID"}};
  const message=String(input.message||"").trim();
  if(!message) return {status:400,body:{ok:false,error:"MESSAGE_REQUIRED"}};
  const gate=approvalGate(sendSnapshot,prospect,channel);
  if(!gate.eligible) return {status:409,body:{ok:false,error:gate.reason}};
  if(channel==="EMAIL"&&!emailApprovalAllowed(gate.approvalId)) return {status:409,body:{ok:false,error:"EMAIL_APPROVAL_NOT_ALLOWED"}};
  if(hash(message)!==gate.approvedMessageHash) return {status:409,body:{ok:false,error:"MESSAGE_CHANGED"}};
  const selectedHealth=channel==="EMAIL"?context.health.email:context.health.whatsapp;
  if(!selectedHealth.canSend) return {status:409,body:{ok:false,error:selectedHealth.configured?"CHANNEL_BLOCKED":channel==="EMAIL"?"EMAIL_PROVIDER_NOT_CONFIGURED":"WHATSAPP_PROVIDER_NOT_CONFIGURED"}};
  const stopGate=prospectStopGate(context.events,prospect,channel);
  if(!stopGate.eligible) return {status:409,body:{ok:false,error:stopGate.reason}};
  const limitGate=channelLimitGate(context.events,channel);
  if(!limitGate.eligible) return {status:409,body:{ok:false,error:limitGate.reason}};
  const optIn=channel==="WHATSAPP"?whatsappOptInGate(sendSnapshot,prospect):null;
  if(optIn&&!optIn.eligible) return {status:409,body:{ok:false,error:optIn.reason}};
  if(channel==="WHATSAPP") {
    const emailSent=context.events.some(row=>row.channel==="EMAIL"&&isSuccessfulSend(row)&&
      ((row.source==="DASHBOARD"&&sameProspect(row,prospect))||(prospect.email&&key(row.recipient)===key(prospect.email))));
    if(!emailSent) return {status:409,body:{ok:false,error:"EMAIL_FIRST_REQUIRED"}};
  }
  const idempotencyKey=gate.idempotencyKey;
  if(input.dryRun===true) {
    sendSnapshot=null;
    context=null;
    stage="PROVIDER_RECONCILIATION";
    if(channel==="EMAIL") {
      const reconciliation=await reconcileBrevoRecipient({email:prospect.email,approvedAt:gate.approvedAt});
      if(!reconciliation.ok) return {status:reconciliation.status||409,body:{ok:false,error:reconciliation.error,stage}};
    }
    return {status:200,body:{ok:true,dryRun:true,stage:"READY_TO_QUEUE",approvalId:gate.approvalId,idempotencyKey}};
  }
  sendSnapshot=null;
  context=null;
  const releaseLocks=acquireSendLocks([`message:${idempotencyKey}`,`channel:${channel}`]);
  if(!releaseLocks) return {status:409,body:{ok:false,error:"SEND_IN_PROGRESS"}};
  const messageId=`MSG-${Date.now()}-${hash(idempotencyKey).slice(0,10)}`;
  let queueRowNumber=null;
  let queueRecord=null;
  let providerAttempted=false;
  try {
    stage="REFRESHING_SEND_CONTEXT";
    let freshSnapshot=await readJson(sheetSnapshotPath,{});
    let freshContext=await sendContext(freshSnapshot,{sourceSheet:prospect.sourceSheet,rowNumber:prospect.rowNumber});
    const freshProspect=freshContext.prospect;
    if(!freshProspect) return {status:404,body:{ok:false,error:"PROSPECT_NOT_FOUND"}};
    const freshGate=approvalGate(freshSnapshot,freshProspect,channel);
    if(!freshGate.eligible) return {status:409,body:{ok:false,error:freshGate.reason}};
    const freshStopGate=prospectStopGate([...freshContext.events,...(freshSnapshot.outreachQueue||[])],freshProspect,channel);
    if(!freshStopGate.eligible) return {status:409,body:{ok:false,error:freshStopGate.reason}};
    const freshLimitGate=channelLimitGate(freshContext.events,channel);
    if(!freshLimitGate.eligible) return {status:409,body:{ok:false,error:freshLimitGate.reason}};
    const previous=freshContext.events.find(row=>row.idempotencyKey===idempotencyKey&&/SEND_ATTEMPT|SENT|OUTCOME_UNKNOWN/i.test(row.eventType||""));
    if(previous) return {status:409,body:{ok:false,error:"DUPLICATE_IDEMPOTENCY_KEY",eventId:previous.eventId}};
    freshSnapshot=null;
    freshContext=null;
    if(channel==="EMAIL") {
      stage="PROVIDER_RECONCILIATION";
      const reconciliation=await reconcileBrevoRecipient({email:freshProspect.email,approvedAt:freshGate.approvedAt});
      if(!reconciliation.ok) return {status:reconciliation.status||409,body:{ok:false,error:reconciliation.error}};
    }
    if(!sheetsWriteConfigured()) return {status:409,body:{ok:false,error:"DURABLE_OPERATIONS_WRITE_REQUIRED"}};
    stage="QUEUE_APPEND";
    queueRecord={
      messageId,idempotencyKey,prospectKey:freshGate.prospectKey,campaignId:freshGate.campaignId,batchId:freshGate.batchId,
      sourceSheet:prospect.sourceSheet,rowNumber:prospect.rowNumber,empresa:prospect.empresa,channel,sequence:1,recipient,
      messageVersion:freshGate.messageVersion,approvalId:freshGate.approvalId,eligibility:"VERIFIED",status:"EN_COLA",
      scheduledAt:new Date().toISOString(),attempts:0,nextAction:"Enviar por adaptador aprobado",
      optInVerified:channel==="WHATSAPP",optInSource:optIn?.source||"",optInRecordedAt:optIn?.recordedAt||"",
      within24hAtEvaluation:channel==="WHATSAPP",templateId:""
    };
    const queued=await appendOutreachQueue(queueRecord);
    queueRowNumber=queued.rowNumber;
    if(!queueRowNumber) throw new Error("OUTREACH_QUEUE_APPEND_UNCONFIRMED");
    const baseEvent={messageId,rowNumber:prospect.rowNumber,sourceSheet:prospect.sourceSheet,empresa:prospect.empresa,channel,recipient,idempotencyKey,messageHash:hash(message),approvalId:gate.approvalId,campaignId:gate.campaignId,batchId:gate.batchId,messageVersion:gate.messageVersion,approval:"HUMAN_DASHBOARD_CLICK",source:"DASHBOARD",actor:"human-dashboard",fromStatus:"APROBADO",toStatus:"EN_COLA",evidence:`approval=${gate.approvalId};message_sha256=${hash(message)}`,optInProviderEventIdHash:channel==="WHATSAPP"?hash(optIn.providerEventId):null,optInRecordedAt:optIn?.recordedAt||null,optInSource:optIn?.source||null,optInScope:optIn?.scope||null};
    stage="ATTEMPT_EVENT_APPEND";
    await appendEvent({...baseEvent,eventType:"SEND_ATTEMPT"});
    stage="PROVIDER_SEND";
    providerAttempted=true;
    const result=channel==="EMAIL"?await sendEmail({prospect,message,idempotencyKey,approvalId:freshGate.approvalId}):await sendWhatsapp({prospect,message,idempotencyKey});
    if(!result.ok) {
      queueRecord={...queueRecord,status:"BLOQUEADO",lastError:result.error,attempts:1,nextAction:"Corregir configuración; no reintentar automáticamente"};
      await updateOutreachQueue(queueRowNumber,queueRecord);
      await appendEvent({...baseEvent,fromStatus:"EN_COLA",toStatus:"BLOQUEADO",eventType:"SEND_BLOCKED",detail:result.error,providerStatus:result.providerStatus||null});
      return {status:result.status||409,body:{ok:false,error:result.error}};
    }
    queueRecord={...queueRecord,status:"ENVIADO",sentAt:new Date().toISOString(),providerRef:hash(result.providerMessageId),outcome:"PENDIENTE_RESPUESTA",attempts:1,nextAction:"Monitorear respuesta"};
    await updateOutreachQueue(queueRowNumber,queueRecord);
    const event=await appendEvent({...baseEvent,fromStatus:"EN_COLA",toStatus:"ENVIADO",eventType:"SENT",providerRef:hash(result.providerMessageId),providerMessageIdHash:hash(result.providerMessageId)});
    lastLiveSyncAt=0;
    try {
      await recordCostUsage({operationId:messageId,idempotencyKey:`COST:${idempotencyKey}`,prospectKey:gate.prospectKey,sourceRow:prospect.rowNumber,empresa:prospect.empresa,stage:"SEND",provider:channel==="EMAIL"?"brevo":"whatsapp",service:channel==="EMAIL"?"transactional-email":"baileys",units:1,unitName:channel==="EMAIL"?"email":"mensaje",metadata:{channel,messageId},recordedBy:"wis-command-center"});
    } catch { /* el envío confirmado no cambia por una falla secundaria de telemetría */ }
    return {status:200,body:{ok:true,eventId:event.eventId,idempotencyKey}};
  } catch(error) {
    console.error("outreach send failed",{
      messageId,
      rowNumber:prospect.rowNumber,
      sourceSheet:prospect.sourceSheet,
      channel,
      stage,
      providerAttempted,
      error:error?.stack||error?.message||String(error)
    });
    if(!providerAttempted) {
      if(queueRowNumber&&queueRecord) {
        queueRecord={...queueRecord,status:"BLOQUEADO",lastError:error.message||"PRE_SEND_FAILED",attempts:0,nextAction:"Corregir la persistencia antes de reintentar"};
        try { await updateOutreachQueue(queueRowNumber,queueRecord); } catch { /* preserve the original pre-send failure */ }
      }
      let event=null;
      try {
        event=await appendEvent({messageId,rowNumber:prospect.rowNumber,sourceSheet:prospect.sourceSheet,empresa:prospect.empresa,channel,recipient,idempotencyKey,messageHash:hash(message),approvalId:gate.approvalId,campaignId:gate.campaignId,batchId:gate.batchId,messageVersion:gate.messageVersion,approval:"HUMAN_DASHBOARD_CLICK",source:"DASHBOARD",actor:"wis-command-center",fromStatus:queueRowNumber?"EN_COLA":"APROBADO",toStatus:"BLOQUEADO",eventType:"SEND_BLOCKED",detail:"PRE_SEND_FAILED",evidence:`stage=${stage}; provider_attempted=false`});
      } catch(eventError) {
        console.error("outreach pre-send event persistence failed",{messageId,stage,error:eventError?.message||String(eventError)});
      }
      return {status:502,body:{ok:false,error:"PRE_SEND_FAILED",stage,eventId:event?.eventId||null,detail:"El proveedor no fue contactado; el envío no salió."}};
    }
    if(queueRowNumber&&queueRecord) {
      queueRecord={...queueRecord,status:"OUTCOME_UNKNOWN",lastError:error.name||"NETWORK_ERROR",attempts:1,nextAction:"Reconciliar proveedor antes de reintentar"};
      try { await updateOutreachQueue(queueRowNumber,queueRecord); } catch { /* preserve original uncertain result */ }
    }
    let event=null;
    try {
      event=await appendEvent({messageId,rowNumber:prospect.rowNumber,sourceSheet:prospect.sourceSheet,empresa:prospect.empresa,channel,recipient,idempotencyKey,messageHash:hash(message),approvalId:gate.approvalId,campaignId:gate.campaignId,batchId:gate.batchId,messageVersion:gate.messageVersion,approval:"HUMAN_DASHBOARD_CLICK",source:"DASHBOARD",actor:"wis-command-center",fromStatus:queueRowNumber?"EN_COLA":"APROBADO",toStatus:"OUTCOME_UNKNOWN",eventType:"OUTCOME_UNKNOWN",detail:error.name||"NETWORK_ERROR",evidence:"Requiere reconciliación durable antes de reintentar"});
    } catch(eventError) {
      console.error("outreach uncertain event persistence failed",{messageId,stage,error:eventError?.message||String(eventError)});
    }
    return {status:502,body:{ok:false,error:"OUTCOME_UNKNOWN",eventId:event?.eventId||null,detail:"Resultado incierto: no se reintentará hasta reconciliar."}};
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
    if(url.pathname==="/api/automation"&&req.method==="GET") {
      const payload=await dashboardPayload();
      return json(res,200,{ok:true,automation:payload.automation});
    }
    if(url.pathname==="/api/automation/commands"&&req.method==="GET") {
      const payload=await dashboardPayload();
      const status=cleanText(url.searchParams.get("status"),40).toUpperCase();
      const commands=(payload.automation?.commandQueue||[]).filter(row=>!status||row.status===status);
      return json(res,200,{ok:true,commands,executor:payload.automation?.executor,config:payload.automation?.config});
    }
    if(url.pathname==="/api/automation/control"&&req.method==="POST") {
      assertMutationRequest(req);
      const input=await requestBody(req);
      const action=cleanText(input.action,60).toUpperCase();
      if(!pipelineControlActions.has(action)) return json(res,400,{ok:false,error:"PIPELINE_ACTION_NOT_ALLOWED"});
      if(action==="PIPELINE_PANIC_STOP"&&input.confirmed!==true) return json(res,400,{ok:false,error:"PANIC_CONFIRMATION_REQUIRED"});
      const payload=await dashboardPayload();
      const config=normalizePipelineConfig(input.config||{},payload.automation?.config||defaultPipelineConfig);
      const createdAt=new Date().toISOString();
      const idempotencyKey=cleanText(input.idempotencyKey,180)||`${action}:${createdAt.slice(0,16)}:${hash(JSON.stringify(config)).slice(0,12)}`;
      const existing=(payload.automation?.recentCommands||[]).find(row=>row.idempotencyKey===idempotencyKey);
      if(existing) return json(res,200,{ok:true,command:existing,automation:payload.automation,deduplicated:true});
      const command={
        commandId:`CMD-${Date.now()}-${randomUUID().slice(0,8)}`,
        createdAt,
        action,
        scope:"WIS_COMMERCIAL_PIPELINE",
        source:"WIS_DASHBOARD",
        requestedBy:"human-dashboard",
        status:"NEW",
        idempotencyKey,
        evidence:JSON.stringify({
          schemaVersion:1,
          requestedAction:action,
          config,
          safety:{externalSendsBlocked:true,email:"APPROVAL_REQUIRED",whatsapp:"OPTIN_AND_APPROVAL_REQUIRED",emailFirst:true},
          note:"Orden durable pendiente de heartbeat; el dashboard no crea subagentes ni envía mensajes."
        })
      };
      if(sheetsWriteConfigured()) await appendTaskCommand(command);
      else if(!isLocalRequest(req)) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      try { await appendFile(commandsPath,`${JSON.stringify(command)}\n`,"utf8"); }
      catch(error) { if(!sheetsWriteConfigured()) throw error; }
      const currentSnapshot=await readJson(sheetSnapshotPath,{});
      const automation=pipelineAutomationState(currentSnapshot.commands||[],await readNdjson(commandsPath,200),currentSnapshot.runs||[],currentSnapshot);
      return json(res,202,{ok:true,command,automation,deduplicated:false});
    }
    if(url.pathname==="/api/costs/pricing"&&req.method==="GET") return json(res,200,{version:PRICING_VERSION,pricing:PRICING});
    if(url.pathname==="/api/research/campaigns/hotels"&&req.method==="GET") {
      const payload=await dashboardPayload();
      return json(res,200,{campaign:HOTEL_CAMPAIGN,costGuard:payload.costs?.zeroCostHotels||null,stats:{total:payload.stats?.prospectsBySheet?.[HOTEL_SHEET]||0}});
    }
    if(url.pathname==="/api/costs/estimate"&&req.method==="POST") {
      assertMutationRequest(req);
      return json(res,200,{ok:true,estimate:estimateScenario(await requestBody(req))});
    }
    if(url.pathname==="/api/costs/usage"&&req.method==="POST") {
      assertMutationRequest(req);
      const configuredToken=process.env.WIS_COST_INGEST_TOKEN;
      if(configuredToken&&req.headers["x-wis-cost-token"]!==configuredToken) return json(res,401,{ok:false,error:"COST_INGEST_TOKEN_INVALID"});
      const record=await recordCostUsage(await requestBody(req));
      return json(res,record.deduplicated?200:201,{ok:true,record,deduplicated:record.deduplicated===true});
    }
    if(url.pathname==="/api/costs/settings"&&req.method==="POST") {
      assertMutationRequest(req);
      if(!sheetsWriteConfigured()) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      const input=await requestBody(req);
      const monthlyBudgetUsd=Math.max(0,Math.min(1_000_000,Number(input.monthlyBudgetUsd)));
      const fixedMonthlyUsd=Math.max(0,Math.min(1_000_000,Number(input.fixedMonthlyUsd)));
      if(!Number.isFinite(monthlyBudgetUsd)||!Number.isFinite(fixedMonthlyUsd)) return json(res,400,{ok:false,error:"COST_SETTINGS_INVALID"});
      await upsertCostSetting("monthly_budget_usd",monthlyBudgetUsd,"Presupuesto mensual aprobado desde Command Center");
      await upsertCostSetting("fixed_monthly_usd",fixedMonthlyUsd,"Costos fijos mensuales informados por el usuario");
      await refreshLiveSheets(true);
      return json(res,200,{ok:true,monthlyBudgetUsd,fixedMonthlyUsd});
    }
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
      const sourceSheet=String(input.sourceSheet||"Distribuidoras_300");
      const prospect=payload.prospects.find(row=>row.rowNumber===rowNumber&&row.sourceSheet===sourceSheet);
      if(!prospect) return json(res,404,{ok:false,error:"PROSPECT_NOT_FOUND"});
      if(prospect.phase==="contacts") return json(res,409,{ok:false,error:"HOTEL_CONTACTS_ONLY"});
      const recipient=channel==="EMAIL"?prospect.email:prospect.whatsapp;
      if(!recipient) return json(res,400,{ok:false,error:"RECIPIENT_MISSING"});
      if(!sheetsWriteConfigured()) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      const draftStorage=await updateProspectMessage(rowNumber,channel,message,sourceSheet);
      const snapshot=await readJson(sheetSnapshotPath,{});
      const cached=(snapshot.prospects||[]).find(row=>Number(row.rowNumber)===rowNumber&&String(row.sourceSheet||"Distribuidoras_300")===sourceSheet);
      if(cached) {
        if(channel==="EMAIL") cached.emailMessage=message;
        else cached.whatsappMessage=message;
        snapshot.fetchedAt=new Date().toISOString();
        await writeJsonAtomic(sheetSnapshotPath,snapshot);
      }
      const savedAt=new Date().toISOString();
      let eventLogged=true;
      try { await appendEvent({messageId:`DRAFT-${sourceSheet}-${rowNumber}-${channel}`,rowNumber,sourceSheet,empresa:prospect.empresa,channel,recipient,eventType:"DRAFT_SAVED",fromStatus:"BORRADOR",toStatus:"BORRADOR",detail:"Borrador actualizado desde el dashboard",actor:"human-dashboard",source:"DASHBOARD",evidence:`message_sha256=${hash(message)}`}); }
      catch { eventLogged=false; }
      try { await recordCostUsage({operationId:`DRAFT-${sourceSheet}-${rowNumber}-${channel}`,idempotencyKey:`COST:DRAFT:${sourceSheet}:${rowNumber}:${channel}:${hash(message)}`,prospectKey:prospectKeyFor(prospect),sourceRow:rowNumber,empresa:prospect.empresa,stage:"COPY",provider:"google",service:"sheets-api",units:1,unitName:"operación",metadata:{channel,event:"DRAFT_SAVED",sourceSheet},recordedBy:"human-dashboard"}); } catch { /* no bloquear el guardado por telemetría */ }
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
      const sizeLabel=request.businessType==="hoteles"?"operación profesional":`${request.employeeSize} empleados`;
      const scope=`${request.quantity} ${request.businessType} · ${request.industry} · ${request.location} · ${sizeLabel}`.slice(0,120);
      const command={
        commandId:`CMD-${Date.now()}-${randomUUID().slice(0,8)}`,
        createdAt:new Date().toISOString(),
        action:"REQUEST_RESEARCH",
        scope,
        source:"WIS_DASHBOARD",
        requestedBy:"human-dashboard",
        status:"NEW",
        idempotencyKey,
        evidence:JSON.stringify({schemaVersion:3,...request,progress:{completed:0,total:request.quantity},costPolicy:request.zeroCostMode?{mode:"ZERO_COST",textSearchLimit:240,placeDetailsLimit:450,safetyMarginPct:20}:null})
      };
      if(sheetsWriteConfigured()) await appendTaskCommand(command);
      else if(!isLocalRequest(req)) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      try { await appendFile(commandsPath,`${JSON.stringify(command)}\n`,"utf8"); }
      catch(error) { if(!sheetsWriteConfigured()) throw error; }
      try { await recordCostUsage({operationId:command.commandId,idempotencyKey:`COST:${command.idempotencyKey}`,runId:command.commandId,stage:"RESEARCH_REQUEST",provider:"google",service:"sheets-api",units:1,unitName:"operación",metadata:{quantity:request.quantity,businessType:request.businessType,industry:request.industry},recordedBy:"human-dashboard"}); } catch { /* el pedido queda válido aunque falle la telemetría */ }
      const hotelExecutor=[HOTEL_CAMPAIGN_ID,HOTEL_LATAM_CAMPAIGN_ID].includes(request.campaignId)&&process.env.WIS_RESEARCH_EXECUTOR_ENABLED==="true";
      if(hotelExecutor) void startHotelResearch(command,request);
      return json(res,202,{ok:true,command,request,deduplicated:false,executorStarted:hotelExecutor});
    }
    if(url.pathname==="/api/actions"&&req.method==="POST") {
      assertMutationRequest(req);
      const input=await requestBody(req);
      if(!allowedActions.has(input.action)) return json(res,400,{ok:false,error:"ACTION_NOT_ALLOWED"});
      const actionCampaignId=String(input.scope||"").includes("LATAM")?HOTEL_LATAM_CAMPAIGN_ID:HOTEL_CAMPAIGN_ID;
      if(input.action==="PAUSE_RESEARCH") pausedResearchCampaigns.add(actionCampaignId);
      if(["CONTINUE_RESEARCH","RETRY_BLOCKED_RESEARCH"].includes(input.action)) pausedResearchCampaigns.delete(actionCampaignId);
      const idempotencyKey=String(input.idempotencyKey||`${input.action}:${new Date().toISOString().slice(0,16)}`).slice(0,180);
      const liveSnapshot=sheetsLiveConfigured()?await refreshLiveSheets(true):await readJson(sheetSnapshotPath,{});
      const existingSheet=(liveSnapshot?.commands||[]).find(item=>(item.idempotency_key||item.idempotencyKey)===idempotencyKey);
      const existingLocal=(await readNdjson(commandsPath,100)).find(item=>item.idempotencyKey===idempotencyKey);
      const existing=existingSheet||existingLocal;
      if(existing) {
        if(["CONTINUE_RESEARCH","RETRY_BLOCKED_RESEARCH"].includes(input.action)&&process.env.WIS_RESEARCH_EXECUTOR_ENABLED==="true") {
          const candidates=[...(liveSnapshot?.commands||[]),...(await readNdjson(commandsPath,200))].map(researchCommand);
          const hotel=candidates.find(row=>row.request?.campaignId===actionCampaignId&&["NEW","READY","IN_PROGRESS","REVIEW","BLOCKED"].includes(row.status));
          if(hotel) void startHotelResearch(hotel,hotel.request);
        }
        return json(res,200,{ok:true,command:existing,deduplicated:true});
      }
      const command={commandId:`CMD-${Date.now()}-${randomUUID().slice(0,8)}`,createdAt:new Date().toISOString(),action:input.action,scope:String(input.scope||"NEXT_PENDING_BATCH").slice(0,120),source:"WIS_DASHBOARD",requestedBy:"human-dashboard",status:"NEW",idempotencyKey,evidence:"Comando creado desde el panel autenticado; pendiente de ejecutor"};
      if(sheetsWriteConfigured()) await appendTaskCommand(command);
      else if(!isLocalRequest(req)) return json(res,409,{ok:false,error:"GOOGLE_SHEETS_WRITES_DISABLED"});
      try { await appendFile(commandsPath,`${JSON.stringify(command)}\n`,"utf8"); }
      catch(error) { if(!sheetsWriteConfigured()) throw error; }
      if(["CONTINUE_RESEARCH","RETRY_BLOCKED_RESEARCH"].includes(input.action)&&process.env.WIS_RESEARCH_EXECUTOR_ENABLED==="true") {
        const candidates=[...(liveSnapshot?.commands||[]),...(await readNdjson(commandsPath,200))].map(researchCommand);
        const hotel=candidates.find(row=>row.request?.campaignId===actionCampaignId&&["NEW","READY","IN_PROGRESS","REVIEW","BLOCKED"].includes(row.status));
        if(hotel) void startHotelResearch(hotel,hotel.request);
      }
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

export { acquireSendLocks, approvalGate, assertMutationRequest, channelHealth, channelLimitGate, dashboardAuthorized, emailApprovalAllowed, explicitE164, normalizePipelineConfig, normalizeProspect, normalizeResearchRequest, pipelineAutomationState, prospectStopGate, reconcileBrevoRecipient, refreshLiveSheets, sendContextFromData, sendSnapshotGate, server, whatsappOptInGate, whatsappProviderConfig, whatsappQuery };
