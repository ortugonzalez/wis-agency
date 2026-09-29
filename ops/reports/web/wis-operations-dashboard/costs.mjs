const DAY=86_400_000;

export const PRICING_VERSION="2026-09-24";
export const PRICING={
  "openai:gpt-6-astra:standard":{kind:"tokens",input:10,cachedInput:1,cacheWrite:12.5,output:50,label:"GPT-6 Astra · Standard"},
  "openai:gpt-6-sol:standard":{kind:"tokens",input:2,cachedInput:.2,cacheWrite:2.5,output:10,label:"GPT-6 Sol · Standard"},
  "openai:gpt-6-luna:standard":{kind:"tokens",input:.1,cachedInput:.01,cacheWrite:.125,output:.5,label:"GPT-6 Luna · Standard"},
  "openai:gpt-6-astra:batch":{kind:"tokens",input:5,cachedInput:.5,cacheWrite:6.25,output:25,label:"GPT-6 Astra · Batch"},
  "openai:gpt-6-sol:batch":{kind:"tokens",input:1,cachedInput:.1,cacheWrite:1.25,output:5,label:"GPT-6 Sol · Batch"},
  "openai:gpt-6-luna:batch":{kind:"tokens",input:.05,cachedInput:.005,cacheWrite:.0625,output:.25,label:"GPT-6 Luna · Batch"},
  "openai:web-search:standard":{kind:"units",unitPrice:.01,unitName:"búsqueda",label:"OpenAI Web Search"},
  "google:places-text-search-ids-only:standard":{kind:"units",unitPrice:0,unitName:"consulta",label:"Google Places Text Search Essentials · IDs Only",freeMonthly:null,sku:"635D-A9DD-C520"},
  "google:places-text-search-pro:standard":{kind:"units",unitPrice:.032,unitName:"consulta",label:"Google Places Text Search Pro",freeMonthly:5000,sku:"4FDA-34B1-A910"},
  "google:places-text-search-enterprise:standard":{kind:"units",unitPrice:.035,unitName:"consulta",label:"Google Places Text Search Enterprise",freeMonthly:1000,sku:"E967-44BC-B44D"},
  "google:places-text-search-enterprise-atmosphere:standard":{kind:"units",unitPrice:.04,unitName:"consulta",label:"Google Places Text Search Enterprise + Atmosphere",freeMonthly:1000,sku:"120C-BEC3-B48F"},
  "google:place-details-ids-only:standard":{kind:"units",unitPrice:0,unitName:"consulta",label:"Google Place Details Essentials · IDs Only",freeMonthly:null,sku:"5C36-E272-E88F"},
  "google:place-details-essentials:standard":{kind:"units",unitPrice:.005,unitName:"consulta",label:"Google Place Details Essentials",freeMonthly:10000,sku:"6E05-E1C3-8D85"},
  "google:place-details-pro:standard":{kind:"units",unitPrice:.017,unitName:"consulta",label:"Google Place Details Pro",freeMonthly:5000,sku:"4ED6-464A-2AFC"},
  "google:place-details-enterprise:standard":{kind:"units",unitPrice:.02,unitName:"consulta",label:"Google Place Details Enterprise",freeMonthly:1000,sku:"2D9A-3DE0-3766"},
  "google:place-details-enterprise-atmosphere:standard":{kind:"units",unitPrice:.025,unitName:"consulta",label:"Google Place Details Enterprise + Atmosphere",freeMonthly:1000,sku:"EB23-5ECC-F753"},
  "brevo:transactional-email:standard":{kind:"units",unitPrice:.0018,unitName:"email",label:"Brevo Starter estimado"},
  "whatsapp:baileys:standard":{kind:"units",unitPrice:0,unitName:"mensaje",label:"WhatsApp por Baileys"},
  "google:sheets-api:standard":{kind:"units",unitPrice:0,unitName:"operación",label:"Google Sheets API"}
};

export const HISTORICAL_COST_AUDITS=[{
  period:"2026-08",provider:"Google Cloud",project:"WIS Prospeccion B2B",service:"Places API (New)",
  sku:"E967-44BC-B44D",skuName:"Places API Text Search Enterprise",units:1921,freeUnits:1000,billableUnits:921,
  unitPriceUsd:.035,subtotalUsd:32.24,taxUsd:null,region:"us-central2",source:"Google Cloud Billing report"
}];

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clean=(value,max=240)=>String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
const money=value=>Math.round((finite(value)+Number.EPSILON)*1e8)/1e8;

export function pricingKey(record={}) {
  return `${clean(record.provider,40).toLowerCase()}:${clean(record.service||record.model,100).toLowerCase()}:${clean(record.pricingTier||"standard",30).toLowerCase()}`;
}

export function calculateUsageCost(record={}) {
  if(record.providerCostUsd!==undefined&&record.providerCostUsd!==null&&record.providerCostUsd!=="") return money(Math.max(0,finite(record.providerCostUsd)));
  const price=PRICING[pricingKey(record)];
  if(!price) return 0;
  if(price.kind==="units") return money(Math.max(0,finite(record.units))*price.unitPrice);
  const input=Math.max(0,finite(record.inputTokens));
  const cached=Math.min(input,Math.max(0,finite(record.cachedInputTokens)));
  const uncached=Math.max(0,input-cached);
  return money((uncached*price.input+cached*price.cachedInput+Math.max(0,finite(record.cacheWriteTokens))*price.cacheWrite+Math.max(0,finite(record.outputTokens))*price.output)/1_000_000);
}

export function normalizeCostRecord(input={},now=new Date()) {
  const value=(camel,snake)=>input[camel]??input[snake];
  const timestamp=clean(input.timestamp,60)||now.toISOString();
  if(!Number.isFinite(Date.parse(timestamp))) throw Object.assign(new Error("COST_TIMESTAMP_INVALID"),{status:400});
  const provider=clean(input.provider,40).toLowerCase();
  const service=clean(input.service||input.model,100).toLowerCase();
  if(!provider||!service) throw Object.assign(new Error("COST_PROVIDER_SERVICE_REQUIRED"),{status:400});
  const record={
    usageId:clean(value("usageId","usage_id"),100),timestamp,operationId:clean(value("operationId","operation_id"),120),idempotencyKey:clean(value("idempotencyKey","idempotency_key"),200),
    runId:clean(value("runId","run_id"),120),prospectKey:clean(value("prospectKey","prospect_key"),160),sourceRow:Math.max(0,Math.trunc(finite(value("sourceRow","source_row")))),
    empresa:clean(input.empresa,160),stage:clean(input.stage||"OTHER",60).toUpperCase(),provider,service,
    model:clean(input.model,100).toLowerCase(),pricingTier:clean(value("pricingTier","pricing_tier")||"standard",30).toLowerCase(),
    inputTokens:Math.max(0,Math.trunc(finite(value("inputTokens","input_tokens")))),cachedInputTokens:Math.max(0,Math.trunc(finite(value("cachedInputTokens","cached_input_tokens")))),
    cacheWriteTokens:Math.max(0,Math.trunc(finite(value("cacheWriteTokens","cache_write_tokens")))),outputTokens:Math.max(0,Math.trunc(finite(value("outputTokens","output_tokens")))),
    reasoningTokens:Math.max(0,Math.trunc(finite(value("reasoningTokens","reasoning_tokens")))),toolCalls:Math.max(0,Math.trunc(finite(value("toolCalls","tool_calls")))),
    units:Math.max(0,finite(input.units)),unitName:clean(value("unitName","unit_name"),50),
    providerCostUsd:value("providerCostUsd","provider_cost_usd")===""||value("providerCostUsd","provider_cost_usd")===null||value("providerCostUsd","provider_cost_usd")===undefined?"":money(Math.max(0,finite(value("providerCostUsd","provider_cost_usd")))),
    costSource:clean(value("costSource","cost_source")||(value("providerCostUsd","provider_cost_usd")!==undefined&&value("providerCostUsd","provider_cost_usd")!==null&&value("providerCostUsd","provider_cost_usd")!==""?"PROVIDER":"PRICE_TABLE"),50).toUpperCase(),
    metadata:typeof input.metadata==="string"?clean(input.metadata,1000):JSON.stringify(input.metadata||{}).slice(0,1000),
    recordedBy:clean(value("recordedBy","recorded_by")||"wis-command-center",80)
  };
  record.calculatedCostUsd=calculateUsageCost(record);
  return record;
}

function monthKey(date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`; }
function safeDivide(a,b) { return b>0?money(a/b):null; }

function applyMonthlyFreeTiers(records=[]) {
  const consumed=new Map();
  return records.slice().sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).map(row=>{
    const price=PRICING[pricingKey(row)];
    const units=Math.max(0,finite(row.units));
    const key=`${monthKey(new Date(row.timestamp))}:${pricingKey(row)}`;
    const before=consumed.get(key)||0;
    consumed.set(key,before+units);
    const providerMeasured=row.providerCostUsd!==""&&row.providerCostUsd!==null&&row.providerCostUsd!==undefined;
    if(!price||price.kind!=="units"||!Number.isFinite(price.freeMonthly)||providerMeasured) return {...row,effectiveCostUsd:row.calculatedCostUsd,freeUnitsApplied:0};
    const freeUnitsApplied=Math.min(units,Math.max(0,price.freeMonthly-before));
    return {...row,freeUnitsApplied,effectiveCostUsd:money((units-freeUnitsApplied)*price.unitPrice)};
  });
}

function estimateMeteredSku(service,units) {
  const cleanService=clean(service,100).toLowerCase();
  const price=PRICING[`google:${cleanService}:standard`];
  const requested=Math.max(0,finite(units));
  if(!price||price.kind!=="units") return {service:cleanService,label:cleanService||"Sin uso",units:requested,freeCap:0,freeApplied:0,billableUnits:requested,costUsd:0};
  const freeCap=Number.isFinite(price.freeMonthly)?price.freeMonthly:null;
  const freeApplied=freeCap===null?requested:Math.min(requested,freeCap);
  const billableUnits=Math.max(0,requested-freeApplied);
  return {service:cleanService,label:price.label,sku:price.sku||"",units:requested,freeCap,freeApplied,billableUnits,unitPriceUsd:price.unitPrice,costUsd:money(billableUnits*price.unitPrice)};
}

export function normalizeCostSettings(rows=[],env={}) {
  const map=Object.fromEntries((rows||[]).map(row=>[String(row.key||row.setting_key||"").trim(),row.value]));
  return {
    currency:"USD",
    monthlyBudgetUsd:Math.max(0,finite(map.monthly_budget_usd??env.WIS_MONTHLY_BUDGET_USD,150)),
    fixedMonthlyUsd:Math.max(0,finite(map.fixed_monthly_usd??env.WIS_FIXED_MONTHLY_COST_USD,0)),
    alertThresholds:[50,75,90,100],
    updatedAt:(rows||[]).map(row=>row.updated_at||row.updatedAt).filter(Boolean).sort().at(-1)||null
  };
}

export function buildCostAnalytics(records=[],settingsInput={},context={},now=new Date()) {
  const settings={currency:"USD",monthlyBudgetUsd:150,fixedMonthlyUsd:0,alertThresholds:[50,75,90,100],...settingsInput};
  const normalized=applyMonthlyFreeTiers((records||[]).map(row=>{
    try { return normalizeCostRecord(row,new Date(row.timestamp||now)); } catch { return null; }
  }).filter(Boolean));
  const thisMonth=monthKey(now);
  const mtd=normalized.filter(row=>monthKey(new Date(row.timestamp))===thisMonth);
  const variableMtd=money(mtd.reduce((sum,row)=>sum+(row.effectiveCostUsd??row.calculatedCostUsd),0));
  const daysInMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).getUTCDate();
  const elapsed=Math.max(1,now.getUTCDate());
  const fixedAccrued=money(settings.fixedMonthlyUsd*elapsed/daysInMonth);
  const spendMtd=money(variableMtd+fixedAccrued);
  const projectedVariable=money(variableMtd/elapsed*daysInMonth);
  const projectedMonth=money(projectedVariable+settings.fixedMonthlyUsd);
  const budgetUsedPct=settings.monthlyBudgetUsd?Math.round(spendMtd/settings.monthlyBudgetUsd*1000)/10:0;
  const projectedBudgetPct=settings.monthlyBudgetUsd?Math.round(projectedMonth/settings.monthlyBudgetUsd*1000)/10:0;
  const alertLevel=projectedBudgetPct>=100?"CRITICAL":projectedBudgetPct>=90?"HIGH":projectedBudgetPct>=75?"MEDIUM":projectedBudgetPct>=50?"LOW":"OK";
  const providerMap=new Map();
  const stageMap=new Map();
  for(const row of mtd) {
    const provider=row.provider||"otro";
    const stage=row.stage||"OTHER";
    const add=(map,key)=>{const value=map.get(key)||{key,costUsd:0,records:0,units:0};value.costUsd=money(value.costUsd+(row.effectiveCostUsd??row.calculatedCostUsd));value.records++;value.units+=row.units||0;map.set(key,value);};
    add(providerMap,provider);add(stageMap,stage);
  }
  const prospects=new Set(mtd.map(row=>row.prospectKey||row.sourceRow&&`row-${row.sourceRow}`).filter(Boolean)).size;
  const hasMeasuredCost=mtd.length>0;
  const qualified=Math.max(0,finite(context.qualified));
  const replies=Math.max(0,finite(context.replies));
  const meetings=Math.max(0,finite(context.meetings));
  const inputTokens=mtd.reduce((sum,row)=>sum+row.inputTokens,0);
  const cachedTokens=mtd.reduce((sum,row)=>sum+row.cachedInputTokens,0);
  const outputTokens=mtd.reduce((sum,row)=>sum+row.outputTokens,0);
  const recommendations=[];
  if(inputTokens&&cachedTokens/inputTokens<.5) recommendations.push({level:"HIGH",title:"Aumentar prompt caching",detail:`Sólo ${Math.round(cachedTokens/inputTokens*100)}% del input está cacheado. Objetivo recomendado: 50% o más.`});
  if(mtd.some(row=>row.provider==="openai"&&row.pricingTier!=="batch"&&/RESEARCH|COPY/.test(row.stage))) recommendations.push({level:"MEDIUM",title:"Mover trabajo no urgente a Batch",detail:"Research y redacción asincrónica pueden reducir aproximadamente a la mitad el costo del modelo."});
  if(mtd.some(row=>row.model.includes("astra")&&!/EXCEPTION|QA/.test(row.stage))) recommendations.push({level:"HIGH",title:"Reservar Astra para excepciones",detail:"Usá Luna para extracción y Sol para casos ambiguos; Astra sólo para revisión compleja."});
  recommendations.push({level:"HIGH",title:"Separar descubrimiento y enriquecimiento en Google Maps",detail:"Usá Text Search IDs/Pro para descubrir candidatos y pedí rating, teléfono, web o reseñas sólo para finalistas. Un campo Enterprise eleva el precio de toda la consulta."});
  if(!normalized.length) recommendations.push({level:"INFO",title:"Empezar a medir desde el próximo lote",detail:"El panel está listo, pero todavía no recibió consumos del ejecutor de research/copy."});
  return {
    pricingVersion:PRICING_VERSION,settings,records:normalized.slice().sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,500),
    summary:{variableMtd,fixedAccrued,spendMtd,projectedMonth,budgetUsedPct,projectedBudgetPct,alertLevel,daysElapsed:elapsed,daysInMonth},
    unitEconomics:{measuredProspects:prospects,qualified,replies,meetings,costPerProspect:hasMeasuredCost?safeDivide(spendMtd,prospects):null,costPerQualified:hasMeasuredCost?safeDivide(spendMtd,qualified):null,costPerReply:hasMeasuredCost?safeDivide(spendMtd,replies):null,costPerMeeting:hasMeasuredCost?safeDivide(spendMtd,meetings):null},
    tokens:{input:inputTokens,cachedInput:cachedTokens,output:outputTokens,reasoning:mtd.reduce((sum,row)=>sum+row.reasoningTokens,0),cacheRate:inputTokens?Math.round(cachedTokens/inputTokens*1000)/10:0,webSearches:mtd.filter(row=>row.provider==="openai"&&row.service==="web-search").reduce((sum,row)=>sum+row.units,0)},
    byProvider:[...providerMap.values()].sort((a,b)=>b.costUsd-a.costUsd),byStage:[...stageMap.values()].sort((a,b)=>b.costUsd-a.costUsd),recommendations,historicalAudits:HISTORICAL_COST_AUDITS,
    sources:{measured:normalized.length>0,ledgerRows:normalized.length,pricingVersion:PRICING_VERSION,modelPricing:"OpenAI official pricing",providerInvoices:"Provider cost overrides calculated estimates when supplied"}
  };
}

export function estimateScenario(input={}) {
  const prospects=Math.max(1,Math.min(100000,Math.trunc(finite(input.prospects,300))));
  const model=clean(input.model||"gpt-6-luna",40).toLowerCase();
  const pricingTier=clean(input.pricingTier||"batch",20).toLowerCase();
  const inputTokens=Math.max(0,finite(input.inputTokensPerProspect,15000))*prospects;
  const cacheRate=Math.max(0,Math.min(100,finite(input.cacheRate,50)))/100;
  const outputTokens=Math.max(0,finite(input.outputTokensPerProspect,2500))*prospects;
  const ai=calculateUsageCost({provider:"openai",service:model,model,pricingTier,inputTokens,cachedInputTokens:inputTokens*cacheRate,outputTokens});
  const web=calculateUsageCost({provider:"openai",service:"web-search",pricingTier:"standard",units:Math.max(0,finite(input.webSearchesPerProspect,0))*prospects});
  const placesTextCalls=input.placesTextCalls!==undefined?finite(input.placesTextCalls):Math.max(0,finite(input.placesTextPerProspect,0))*prospects;
  const placeDetailsCalls=input.placeDetailsCalls!==undefined?finite(input.placeDetailsCalls):Math.max(0,finite(input.placeDetailsPerProspect,0))*prospects;
  const placesText=estimateMeteredSku(input.placesTextService||"places-text-search-pro",placesTextCalls);
  const placeDetails=estimateMeteredSku(input.placeDetailsService||"place-details-enterprise-atmosphere",placeDetailsCalls);
  const emails=Math.max(0,finite(input.emailsPerProspect,1))*prospects*.0018;
  const fixed=Math.max(0,finite(input.fixedMonthlyUsd,0));
  const places=money(placesText.costUsd+placeDetails.costUsd);
  const total=money(ai+web+places+emails+fixed);
  return {prospects,totalUsd:total,costPerProspect:safeDivide(total,prospects),breakdown:{ai:money(ai),webSearch:money(web),places,email:money(emails),fixed:money(fixed)},placesUsage:{textSearch:placesText,placeDetails}};
}
