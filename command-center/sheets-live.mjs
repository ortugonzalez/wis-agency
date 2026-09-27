import { createSign } from "node:crypto";

const SHEETS_READ_SCOPE="https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEETS_WRITE_SCOPE="https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const DEFAULT_COMMERCIAL_ID="1HoVbDf_In8urKkiUnfkE-j3TPq0vrI4pjfPoAYKJYl8";
const DEFAULT_OPERATIONS_ID="1oJxHk_FeDiZ3FUi3ugd2xheiJSrA9OgdRQn5EJgpN_w";

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
  const response=await fetch(url,{
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
  const response=await fetch(url,{
    method:"PUT",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({majorDimension:"ROWS",values:[values]}),
    signal:AbortSignal.timeout(30_000)
  });
  if(!response.ok) throw new Error(`GOOGLE_SHEETS_UPDATE_FAILED_${response.status}`);
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

async function batchGet(spreadsheetId,ranges,token) {
  const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
  ranges.forEach(range=>url.searchParams.append("ranges",range));
  url.searchParams.set("valueRenderOption","FORMATTED_VALUE");
  const response=await fetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30_000)});
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
    batchGet(commercialId,["Distribuidoras_300!A1:L350"],token),
    batchGet(operationsId,[
      "Outreach_Queue!A1:AA2000",
      "Outreach_Events!A1:L2000",
      "Approvals!A1:Z1000",
      "Runs!A1:Z1000",
      "Task_Commands!A1:L500",
      "Channel_Health!A1:J100"
    ],token)
  ]);
  const prospects=objects(commercial[0]?.values).map((row,index)=>({
    rowNumber:index+2,
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
    whatsappMessage:row["Mensaje WhatsApp"],
    emailMessage:row["Mensaje Email"]
  }));
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
    sheetName:"Distribuidoras_300",
    operationsSpreadsheetId:operationsId,
    prospects,
    qa:[],
    approvals,
    outreachQueue:queue,
    events,
    runs:objects(operations[3]?.values),
    commands:objects(operations[4]?.values),
    channelHealth:objects(operations[5]?.values),
    optIns:[],
    providerReconciliationLoaded:process.env.WIS_PROVIDER_RECONCILIATION_TRUSTED==="true"
  };
}
