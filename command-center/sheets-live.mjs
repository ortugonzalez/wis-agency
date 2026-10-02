import { createSign } from "node:crypto";

const SHEETS_READ_SCOPE="https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEETS_WRITE_SCOPE="https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const DEFAULT_COMMERCIAL_ID="1HoVbDf_In8urKkiUnfkE-j3TPq0vrI4pjfPoAYKJYl8";
const DEFAULT_OPERATIONS_ID="1oJxHk_FeDiZ3FUi3ugd2xheiJSrA9OgdRQn5EJgpN_w";
export const COMMERCIAL_SHEETS={
  Distribuidoras_300:{campaignId:"distribuidoras-300",phase:"outreach",range:"A1:L350"},
  Hoteles_Argentina_300:{campaignId:"hoteles-argentina-300",phase:"contacts",range:"A1:L350",target:300},
  Hoteles_LATAM_500:{campaignId:"hoteles-latam-500",phase:"contacts",range:"A1:L600",target:500}
};
const DRAFTS_SHEET="Message_Drafts";
const DRAFT_HEADERS=["draft_key","source_sheet","source_row","channel","message","updated_at","updated_by"];
const COST_LEDGER_SHEET="Cost_Ledger";
const COST_LEDGER_HEADERS=["usage_id","timestamp","operation_id","idempotency_key","run_id","prospect_key","source_row","empresa","stage","provider","service","model","pricing_tier","input_tokens","cached_input_tokens","cache_write_tokens","output_tokens","reasoning_tokens","tool_calls","units","unit_name","provider_cost_usd","calculated_cost_usd","cost_source","metadata","recorded_by"];
const COST_SETTINGS_SHEET="Cost_Settings";
const COST_SETTINGS_HEADERS=["key","value","updated_at","updated_by","note"];
const RESEARCH_EVIDENCE_SHEET="Research_Evidence";
const RESEARCH_EVIDENCE_HEADERS=["evidence_id","timestamp","command_id","campaign_id","batch_id","prospect_key","source_url","evidence_type","decision","detail","score","recorded_by"];
const ensuredOperationalSheets=new Set();

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function privateKey() {
  if(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64) {
    return Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64,"base64").toString("utf8");
  }
  return String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY||"").replace(/\\n/g,"\n");
}

export function sheetsLiveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&privateKey());
}

let tokenCache={token:"",scope:"",expiresAt:0};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function sheetsFetch(url,options={}) {
  const waits=[5_000,10_000,20_000,30_000];
  for(let attempt=0;;attempt++) {
    const response=await fetch(url,options);
    if(![429,503].includes(response.status)||attempt>=waits.length) return response;
    try { await response.text(); } catch { /* release response before retry */ }
    await sleep(waits[attempt]);
  }
}

async function accessToken() {
  if(!sheetsLiveConfigured()) throw new Error("GOOGLE_SHEETS_CREDENTIALS_NOT_CONFIGURED");
  const now=Math.floor(Date.now()/1000);
  const scope=process.env.WIS_SHEETS_WRITES_ENABLED==="true"?SHEETS_WRITE_SCOPE:SHEETS_READ_SCOPE;
  if(tokenCache.token&&tokenCache.scope===scope&&tokenCache.expiresAt>now+60) return tokenCache.token;
  const header=base64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=base64url(JSON.stringify({
    iss:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope,
    aud:TOKEN_URL,
    iat:now,
    exp:now+3600
  }));
  const unsigned=`${header}.${claims}`;
  const signer=createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion=`${unsigned}.${signer.sign(privateKey()).toString("base64url")}`;
  const response=await fetch(TOKEN_URL,{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),
    signal:AbortSignal.timeout(20_000)
  });
  const body=await response.json();
  if(!response.ok||!body.access_token) throw new Error(`GOOGLE_TOKEN_FAILED_${response.status}`);
  tokenCache={token:body.access_token,scope,expiresAt:now+Number(body.expires_in||3600)};
  return body.access_token;
}

export function sheetsWriteConfigured() {
  return sheetsLiveConfigured()&&process.env.WIS_SHEETS_WRITES_ENABLED==="true";
}

async function appendValues(spreadsheetId,range,values) {
  if(!sheetsWriteConfigured()) throw new Error("GOOGLE_SHEETS_WRITES_DISABLED");
  const token=await accessToken();
  const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`);
  url.searchParams.set("valueInputOption","RAW");
  url.searchParams.set("insertDataOption","INSERT_ROWS");
  url.searchParams.set("includeValuesInResponse","false");
  const response=await sheetsFetch(url,{
    method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({majorDimension:"ROWS",values:[values]}),
    signal:AbortSignal.timeout(30_000)
  });
  const body=await response.json();
  if(!response.ok) throw new Error(`GOOGLE_SHEETS_APPEND_FAILED_${response.status}`);
  return body.updates?.updatedRange||"";
}

async function updateValues(spreadsheetId,range,values) {
  if(!sheetsWriteConfigured()) throw new Error("GOOGLE_SHEETS_WRITES_DISABLED");
  const token=await accessToken();
  const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("valueInputOption","RAW");
  const response=await sheetsFetch(url,{
    method:"PUT",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({majorDimension:"ROWS",values:[values]}),
    signal:AbortSignal.timeout(30_000)
  });
  if(!response.ok) throw new Error(`GOOGLE_SHEETS_UPDATE_FAILED_${response.status}`);
}

async function ensureDraftsSheet() {
  await ensureOperationalSheet(DRAFTS_SHEET,DRAFT_HEADERS);
}

async function ensureOperationalSheet(sheetName,headers) {
  if(ensuredOperationalSheets.has(sheetName)) return;
  const spreadsheetId=operationsId();
  const token=await accessToken();
  const metadataUrl=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
  metadataUrl.searchParams.set("fields","sheets.properties(sheetId,title)");
  const metadataResponse=await sheetsFetch(metadataUrl,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30_000)});
  const metadata=await metadataResponse.json();
  if(!metadataResponse.ok) throw new Error(`GOOGLE_SHEETS_METADATA_FAILED_${metadataResponse.status}`);
  let sheet=(metadata.sheets||[]).find(item=>item?.properties?.title===sheetName);
  const exists=Boolean(sheet);
  if(!exists) {
    const response=await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,{
      method:"POST",
      headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
      body:JSON.stringify({requests:[{addSheet:{properties:{title:sheetName}}}]}),
      signal:AbortSignal.timeout(30_000)
    });
    const created=await response.json();
    if(!response.ok&&response.status!==400) throw new Error(`GOOGLE_SHEETS_ADD_SHEET_FAILED_${response.status}`);
    sheet=created.replies?.[0]?.addSheet||sheet;
  }
  const lastColumn=columnName(headers.length);
  const current=await batchGet(spreadsheetId,[`${sheetName}!A1:${lastColumn}1`],token);
  if(!(current[0]?.values?.[0]||[]).length) await updateValues(spreadsheetId,`${sheetName}!A1:${lastColumn}1`,headers);
  if(Number.isInteger(sheet?.properties?.sheetId)) await formatOperationalSheet(spreadsheetId,sheet.properties.sheetId,headers.length,token);
  ensuredOperationalSheets.add(sheetName);
}

async function formatOperationalSheet(spreadsheetId,sheetId,columnCount,token) {
  const response=await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,{
    method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({requests:[
      {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:1}},fields:"gridProperties.frozenRowCount"}},
      {repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:columnCount},cell:{userEnteredFormat:{backgroundColor:{red:.055,green:.075,blue:.067},textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true},verticalAlignment:"MIDDLE",wrapStrategy:"WRAP"}},fields:"userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)"}},
      {autoResizeDimensions:{dimensions:{sheetId,dimension:"COLUMNS",startIndex:0,endIndex:columnCount}}}
    ]}),
    signal:AbortSignal.timeout(30_000)
  });
  if(!response.ok) throw new Error(`GOOGLE_SHEETS_FORMAT_FAILED_${response.status}`);
}

function columnName(number) {
  let result="";
  for(let value=number;value>0;value=Math.floor((value-1)/26)) result=String.fromCharCode(65+(value-1)%26)+result;
  return result;
}

function allowedCommercialSheet(sourceSheet) {
  const value=String(sourceSheet||"Distribuidoras_300").trim();
  if(!COMMERCIAL_SHEETS[value]) throw new Error("COMMERCIAL_SHEET_NOT_ALLOWED");
  return value;
}

async function upsertMessageDraft(rowNumber,channel,message,sourceSheet="Distribuidoras_300") {
  await ensureDraftsSheet();
  const spreadsheetId=operationsId();
  const token=await accessToken();
  const range=await batchGet(spreadsheetId,[`${DRAFTS_SHEET}!A1:G2000`],token);
  const values=range[0]?.values||[];
  const normalizedSheet=allowedCommercialSheet(sourceSheet);
  const draftKey=`${normalizedSheet}:${rowNumber}:${channel}`;
  const sheetRow=values.findIndex((row,index)=>index>0&&row[0]===draftKey)+1;
  const record=[draftKey,normalizedSheet,rowNumber,channel,message,new Date().toISOString(),"human-dashboard"];
  if(sheetRow>0) await updateValues(spreadsheetId,`${DRAFTS_SHEET}!A${sheetRow}:G${sheetRow}`,record);
  else await appendValues(spreadsheetId,`${DRAFTS_SHEET}!A:G`,record);
  return draftKey;
}

function operationsId() {
  return process.env.WIS_OPERATIONS_SHEET_ID||DEFAULT_OPERATIONS_ID;
}

export async function appendTaskCommand(command) {
  return appendValues(operationsId(),"Task_Commands!A:L",[
    command.commandId,command.createdAt,command.action,command.scope,command.source,
    command.requestedBy,command.status,command.idempotencyKey,"","","",command.evidence||""
  ]);
}

export async function appendOutreachEvent(event) {
  return appendValues(operationsId(),"Outreach_Events!A:L",[
    event.eventId,event.messageId||"",event.timestamp,event.channel||"",event.fromStatus||"",
    event.toStatus||event.status||"",event.eventType,event.providerRef||"",event.detail||"",
    event.reconciled===true?"TRUE":"FALSE",event.actor||"wis-command-center",event.evidence||""
  ]);
}

export async function appendOutreachQueue(row) {
  const range=await appendValues(operationsId(),"Outreach_Queue!A:AA",[
    row.messageId,row.idempotencyKey,row.prospectKey,row.campaignId,row.batchId,row.sourceSheet,row.rowNumber,
    row.empresa,row.channel,row.sequence,row.recipient,row.messageVersion,row.approvalId,row.eligibility,row.status,
    row.scheduledAt||"",row.sentAt||"",row.providerRef||"",row.outcome||"",row.lastError||"",row.attempts||0,
    row.nextAction||"",row.optInVerified===true?"TRUE":"FALSE",row.optInSource||"",row.optInRecordedAt||"",
    row.within24hAtEvaluation===true?"TRUE":"FALSE",row.templateId||""
  ]);
  const match=range.match(/!A(\d+):AA\d+$/);
  return {updatedRange:range,rowNumber:match?Number(match[1]):null};
}

export async function updateOutreachQueue(rowNumber,row) {
  if(!Number.isInteger(rowNumber)||rowNumber<2) throw new Error("OUTREACH_QUEUE_ROW_INVALID");
  await updateValues(operationsId(),`Outreach_Queue!A${rowNumber}:AA${rowNumber}`,[
    row.messageId,row.idempotencyKey,row.prospectKey,row.campaignId,row.batchId,row.sourceSheet,row.rowNumber,
    row.empresa,row.channel,row.sequence,row.recipient,row.messageVersion,row.approvalId,row.eligibility,row.status,
    row.scheduledAt||"",row.sentAt||"",row.providerRef||"",row.outcome||"",row.lastError||"",row.attempts||0,
    row.nextAction||"",row.optInVerified===true?"TRUE":"FALSE",row.optInSource||"",row.optInRecordedAt||"",
    row.within24hAtEvaluation===true?"TRUE":"FALSE",row.templateId||""
  ]);
}

export async function updateProspectMessage(rowNumber,channel,message,sourceSheet="Distribuidoras_300") {
  if(!Number.isInteger(rowNumber)||rowNumber<2) throw new Error("PROSPECT_ROW_INVALID");
  const normalizedChannel=String(channel||"").toUpperCase();
  if(!["EMAIL","WHATSAPP"].includes(normalizedChannel)) throw new Error("CHANNEL_INVALID");
  const normalizedSheet=allowedCommercialSheet(sourceSheet);
  if(COMMERCIAL_SHEETS[normalizedSheet].phase==="contacts") throw new Error("HOTEL_CONTACTS_ONLY");
  const column=normalizedChannel==="EMAIL"?"L":"K";
  const normalizedMessage=String(message||"").trim();
  const draftKey=await upsertMessageDraft(rowNumber,normalizedChannel,normalizedMessage,normalizedSheet);
  let commercialSheetUpdated=true;
  try {
    await updateValues(process.env.WIS_COMMERCIAL_SHEET_ID||DEFAULT_COMMERCIAL_ID,`${normalizedSheet}!${column}${rowNumber}`,[normalizedMessage]);
  } catch(error) {
    if(!String(error?.message||"").endsWith("_403")) throw error;
    commercialSheetUpdated=false;
  }
  return {rowNumber,column,channel:normalizedChannel,sourceSheet:normalizedSheet,draftKey,commercialSheetUpdated};
}

export async function updateTaskCommandStatus(commandId,status,evidence) {
  if(!String(commandId||"").trim()) throw new Error("COMMAND_ID_REQUIRED");
  const spreadsheetId=operationsId();
  const token=await accessToken();
  const values=(await batchGet(spreadsheetId,["Task_Commands!A1:L1000"],token))[0]?.values||[];
  const rowNumber=values.findIndex((row,index)=>index>0&&row[0]===commandId)+1;
  if(rowNumber<2) throw new Error("TASK_COMMAND_NOT_FOUND");
  await updateValues(spreadsheetId,`Task_Commands!G${rowNumber}`,[String(status||"")]);
  await updateValues(spreadsheetId,`Task_Commands!L${rowNumber}`,[typeof evidence==="string"?evidence:JSON.stringify(evidence||{})]);
  return {commandId,rowNumber,status};
}

export async function appendResearchEvidence(row) {
  await ensureOperationalSheet(RESEARCH_EVIDENCE_SHEET,RESEARCH_EVIDENCE_HEADERS);
  return appendValues(operationsId(),`${RESEARCH_EVIDENCE_SHEET}!A:L`,[
    row.evidenceId,row.timestamp,row.commandId,row.campaignId,row.batchId,row.prospectKey,row.sourceUrl,
    row.evidenceType,row.decision,row.detail,row.score??"",row.recordedBy||"prospect-research"
  ]);
}

export async function appendCommercialProspects(sourceSheet,rows=[]) {
  const normalizedSheet=allowedCommercialSheet(sourceSheet);
  if(!Array.isArray(rows)||!rows.length) return {rows:0,updatedRange:""};
  if(rows.some(row=>!Array.isArray(row)||row.length!==12)) throw new Error("COMMERCIAL_ROW_WIDTH_INVALID");
  if(COMMERCIAL_SHEETS[normalizedSheet].phase==="contacts"&&rows.some(row=>row.slice(7).some(value=>String(value||"").trim()))) throw new Error("HOTEL_PHASE_ONE_COLUMNS_ONLY");
  const spreadsheetId=process.env.WIS_COMMERCIAL_SHEET_ID||DEFAULT_COMMERCIAL_ID;
  const token=await accessToken();
  const existing=(await batchGet(spreadsheetId,[`${normalizedSheet}!${COMMERCIAL_SHEETS[normalizedSheet].range.split("!").pop()}`],token))[0]?.values||[];
  const normalized=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
  const domain=value=>{ try { return new URL(/^https?:\/\//i.test(String(value||""))?String(value):`https://${value}`).hostname.replace(/^www\./i,"").toLowerCase(); } catch { return ""; } };
  const phone=value=>String(value||"").replace(/\D/g,"");
  const rowKeys=row=>[
    normalized(row[1])&&normalized(row[2])?`name:${normalized(row[1])}|${normalized(row[2])}`:"",
    domain(row[4])?`domain:${domain(row[4])}`:"",
    normalized(row[5])?`email:${normalized(row[5])}`:"",
    phone(row[3])?`phone:${phone(row[3])}`:""
  ].filter(Boolean);
  const keys=new Set(existing.slice(1).flatMap(rowKeys));
  const unique=[];
  for(const row of rows) {
    const candidateKeys=rowKeys(row);
    if(candidateKeys.some(key=>keys.has(key))) continue;
    candidateKeys.forEach(key=>keys.add(key));
    unique.push(row);
  }
  const target=Number(COMMERCIAL_SHEETS[normalizedSheet].target||0);
  if(target) unique.splice(Math.max(0,target-Math.max(0,existing.length-1)));
  if(!unique.length) return {rows:0,updatedRange:"",deduplicated:true};
  const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${normalizedSheet}!A:L`)}:append`);
  url.searchParams.set("valueInputOption","RAW");
  url.searchParams.set("insertDataOption","INSERT_ROWS");
  const response=await sheetsFetch(url,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({majorDimension:"ROWS",values:unique}),signal:AbortSignal.timeout(30_000)});
  const body=await response.json();
  if(!response.ok) throw new Error(`GOOGLE_SHEETS_APPEND_FAILED_${response.status}`);
  return {rows:unique.length,updatedRange:body.updates?.updatedRange||"",deduplicated:unique.length!==rows.length};
}

export async function appendCostUsage(row) {
  await ensureOperationalSheet(COST_LEDGER_SHEET,COST_LEDGER_HEADERS);
  return appendValues(operationsId(),`${COST_LEDGER_SHEET}!A:Z`,[
    row.usageId,row.timestamp,row.operationId,row.idempotencyKey,row.runId,row.prospectKey,row.sourceRow||"",row.empresa,row.stage,
    row.provider,row.service,row.model,row.pricingTier,row.inputTokens,row.cachedInputTokens,row.cacheWriteTokens,row.outputTokens,
    row.reasoningTokens,row.toolCalls,row.units,row.unitName,row.providerCostUsd,row.calculatedCostUsd,row.costSource,row.metadata,row.recordedBy
  ]);
}

export async function upsertCostSetting(key,value,note="",updatedBy="human-dashboard") {
  await ensureOperationalSheet(COST_LEDGER_SHEET,COST_LEDGER_HEADERS);
  await ensureOperationalSheet(COST_SETTINGS_SHEET,COST_SETTINGS_HEADERS);
  const spreadsheetId=operationsId();
  const token=await accessToken();
  const range=await batchGet(spreadsheetId,[`${COST_SETTINGS_SHEET}!A1:E500`],token);
  const values=range[0]?.values||[];
  const normalized=String(key||"").trim();
  const rowNumber=values.findIndex((row,index)=>index>0&&row[0]===normalized)+1;
  const record=[normalized,String(value),new Date().toISOString(),updatedBy,String(note||"")];
  if(rowNumber>0) await updateValues(spreadsheetId,`${COST_SETTINGS_SHEET}!A${rowNumber}:E${rowNumber}`,record);
  else await appendValues(spreadsheetId,`${COST_SETTINGS_SHEET}!A:E`,record);
  return {key:normalized,value,rowNumber:rowNumber||null};
}

async function batchGet(spreadsheetId,ranges,token) {
  const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
  ranges.forEach(range=>url.searchParams.append("ranges",range));
  url.searchParams.set("valueRenderOption","FORMATTED_VALUE");
  const response=await sheetsFetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30_000)});
  const body=await response.json();
  if(!response.ok) throw new Error(`GOOGLE_SHEETS_READ_FAILED_${response.status}`);
  return body.valueRanges||[];
}

function objects(values=[]) {
  const [headers=[],...rows]=values;
  return rows.filter(row=>row.some(value=>String(value||"").trim())).map(row=>
    Object.fromEntries(headers.map((header,index)=>[String(header||"").trim(),row[index]??""]))
  );
}

function bool(value) {
  return ["TRUE","SI","SÍ","YES","1"].includes(String(value||"").trim().toUpperCase());
}

function number(value,fallback=0) {
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:fallback;
}

function parseApproval(row) {
  if(row.decision!=="APPROVED"||!/^OUTREACH_BATCH/i.test(row.action||"")) return null;
  try {
    const evidence=JSON.parse(row.evidence||"{}");
    return {
      approvalId:row.approval_id,
      decision:row.decision,
      expiresAt:evidence.expiresAt,
      campaignId:evidence.campaignId,
      batchId:evidence.batchId,
      channels:evidence.channels,
      messageVersions:evidence.messageVersions,
      sequences:evidence.sequences,
      prospectRows:evidence.prospectRows,
      recipientLimit:evidence.recipientLimit
    };
  } catch { return null; }
}

export async function buildLiveSnapshot() {
  const token=await accessToken();
  const commercialId=process.env.WIS_COMMERCIAL_SHEET_ID||DEFAULT_COMMERCIAL_ID;
  const operationsId=process.env.WIS_OPERATIONS_SHEET_ID||DEFAULT_OPERATIONS_ID;
  const [commercial,operations]=await Promise.all([
    batchGet(commercialId,Object.entries(COMMERCIAL_SHEETS).map(([sheet,profile])=>`${sheet}!${profile.range}`),token),
    batchGet(operationsId,[
      "Outreach_Queue!A1:AA2000",
      "Outreach_Events!A1:L2000",
      "Approvals!A1:Z1000",
      "Runs!A1:Z1000",
      "Task_Commands!A1:L500",
      "Channel_Health!A1:J100"
    ],token)
  ]);
  let draftRanges=[];
  try { draftRanges=await batchGet(operationsId,[`${DRAFTS_SHEET}!A1:G2000`],token); }
  catch(error) { if(!String(error?.message||"").endsWith("_400")) throw error; }
  let costRanges=[];
  try { costRanges=await batchGet(operationsId,[`${COST_LEDGER_SHEET}!A1:Z5000`,`${COST_SETTINGS_SHEET}!A1:E500`],token); }
  catch(error) { if(!String(error?.message||"").endsWith("_400")) throw error; }
  const drafts=objects(draftRanges[0]?.values);
  const draftsByKey=new Map(drafts.map(row=>[row.draft_key,row]));
  const prospects=[];
  Object.entries(COMMERCIAL_SHEETS).forEach(([sourceSheet,profile],sheetIndex)=>{
    objects(commercial[sheetIndex]?.values).forEach((row,index)=>{
      const rowNumber=index+2;
      const emailDraft=draftsByKey.get(`${sourceSheet}:${rowNumber}:EMAIL`);
      const whatsappDraft=draftsByKey.get(`${sourceSheet}:${rowNumber}:WHATSAPP`);
      prospects.push({
    prospectId:`${sourceSheet}:${rowNumber}`,
    sourceSheet,
    campaignId:profile.campaignId,
    phase:profile.phase,
    rowNumber,
    rubro:row.Rubro,
    empresa:row.Empresa,
    ubicacion:row["Ubicación"],
    whatsapp:row.WhatsApp,
    web:row.Web,
    email:row.Email,
    rating:row.Rating,
    reviewsAnalyzed:row["Reseñas analizadas"],
    problems:row.Problemas,
    analysis:row["ANALISIS NEGOCIO"],
    whatsappMessage:whatsappDraft?.message||row["Mensaje WhatsApp"],
    emailMessage:emailDraft?.message||row["Mensaje Email"]
      });
    });
  });
  const queue=objects(operations[0]?.values).map(row=>({
    messageId:row.message_id,
    idempotencyKey:row.idempotency_key,
    prospectKey:row.prospect_key,
    campaignId:row.campaign_id,
    batchId:row.batch_id,
    sourceSheet:row.source_sheet,
    rowNumber:number(row.source_row,null),
    empresa:row.empresa,
    channel:row.channel,
    sequence:number(row.sequence,1),
    recipient:row.recipient,
    messageVersion:row.message_version,
    approvalId:row.approval_id,
    eligibility:row.eligibility,
    status:row.status,
    scheduledAt:row.scheduled_at,
    sentAt:row.sent_at,
    providerRef:row.provider_ref,
    outcome:row.outcome,
    lastError:row.last_error,
    attempts:number(row.attempts),
    nextAction:row.next_action,
    optInVerified:bool(row.opt_in_verified),
    optInSource:row.opt_in_source,
    optInRecordedAt:row.opt_in_recorded_at,
    within24hAtEvaluation:bool(row.within_24h_at_evaluation),
    templateId:row.template_id
  }));
  const queueByMessage=new Map(queue.map(row=>[row.messageId,row]));
  const events=objects(operations[1]?.values).map(row=>{
    const linked=queueByMessage.get(row.message_id)||{};
    return {
      eventId:row.event_id,
      messageId:row.message_id,
      timestamp:row.timestamp,
      channel:row.channel||linked.channel,
      fromStatus:row.from_status,
      status:row.to_status,
      eventType:row.event_type,
      providerRef:row.provider_ref,
      detail:row.reason,
      reconciled:bool(row.reconciled),
      actor:row.actor,
      evidence:row.evidence,
      empresa:linked.empresa,
      recipient:linked.recipient,
      rowNumber:linked.rowNumber,
      idempotencyKey:linked.idempotencyKey,
      source:"GOOGLE_SHEETS"
    };
  });
  const approvals=objects(operations[2]?.values).map(parseApproval).filter(Boolean);
  return {
    schemaVersion:2,
    fetchedAt:new Date().toISOString(),
    source:"GOOGLE_SHEETS_LIVE",
    spreadsheetId:commercialId,
    sheetName:"MULTI_CAMPAIGN",
    sheetNames:Object.keys(COMMERCIAL_SHEETS),
    operationsSpreadsheetId:operationsId,
    prospects,
    qa:[],
    approvals,
    outreachQueue:queue,
    events,
    runs:objects(operations[3]?.values),
    commands:objects(operations[4]?.values),
    channelHealth:objects(operations[5]?.values),
    costLedger:objects(costRanges[0]?.values),
    costSettings:objects(costRanges[1]?.values),
    optIns:[],
    providerReconciliationLoaded:process.env.WIS_PROVIDER_RECONCILIATION_TRUSTED==="true"
  };
}
