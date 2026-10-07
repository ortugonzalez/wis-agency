import { randomUUID } from "node:crypto";
import {
  CORRALONES_CAMPAIGN_ID,
  MADERERAS_CAMPAIGN_ID,
  evaluateSupplierCandidate,
  normalizeEmails,
  normalizeWhatsapps,
  supplierCampaignProfile,
  supplierDedupeKeys,
  supplierProspectKey,
  supplierSheetRow
} from "./supplier-research.mjs";

const COUNTRIES=[
  ["AR","Argentina"],["MX","México"],["CO","Colombia"],["CL","Chile"],["BR","Brasil"],
  ["PE","Perú"],["UY","Uruguay"],["PY","Paraguay"],["BO","Bolivia"],["EC","Ecuador"],
  ["CR","Costa Rica"],["PA","Panamá"],["GT","Guatemala"],["DO","República Dominicana"],
  ["SV","El Salvador"],["HN","Honduras"],["NI","Nicaragua"]
];

const OVERPASS_ENDPOINTS=[
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const clean=value=>String(value??"").trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function htmlText(html) {
  return clean(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").slice(0,160_000);
}

function linkValues(html,baseUrl) {
  const values=[];
  for(const match of String(html||"").matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try { values.push(new URL(match[1],baseUrl).href); } catch { /* invalid public link */ }
  }
  return values;
}

function sameHost(left,right) {
  try { return new URL(left).hostname.replace(/^www\./i,"").toLowerCase()===new URL(right).hostname.replace(/^www\./i,"").toLowerCase(); }
  catch { return false; }
}

export function extractPublishedContactSet(html,pageUrl) {
  const links=linkValues(html,pageUrl);
  const visible=htmlText(html);
  const mailtos=links.filter(link=>/^mailto:/i.test(link)).map(link=>link.replace(/^mailto:/i,"").split(/[?&#]/)[0]);
  const visibleEmails=visible.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[];
  const pageHost=(()=>{ try { return new URL(pageUrl).hostname.replace(/^www\./i,"").toLowerCase(); } catch { return ""; } })();
  const publicMailboxDomains=new Set(["gmail.com","hotmail.com","outlook.com","yahoo.com","yahoo.com.ar","live.com"]);
  const trustedVisibleEmails=visibleEmails.filter(value=>{
    const emailDomain=value.split("@")[1]?.toLowerCase()||"";
    return publicMailboxDomains.has(emailDomain)||emailDomain===pageHost||pageHost.endsWith(`.${emailDomain}`)||emailDomain.endsWith(`.${pageHost}`);
  });
  const whatsappLinks=links.filter(link=>/(?:wa\.me\/|api\.whatsapp\.com\/|whatsapp\.com\/send)/i.test(link));
  const whatsapps=whatsappLinks.map(link=>link.match(/(?:wa\.me\/|phone=)(\d{8,15})/i)?.[1]).filter(Boolean).map(value=>`+${value}`);
  const contactLinks=links.filter(link=>sameHost(link,pageUrl)&&/(?:contacto|contact|ventas|sucursales|ubicaciones|atendimento|fale-conosco)/i.test(link)).slice(0,4);
  return {
    emails:normalizeEmails([...mailtos,...trustedVisibleEmails]),
    whatsapps:normalizeWhatsapps(whatsapps),
    emailSources:mailtos.length?[pageUrl]:[],
    whatsappSources:whatsappLinks,
    contactLinks,
    websiteText:visible
  };
}

async function fetchHtml(url,fetchImpl=fetch) {
  if(!/^https?:\/\//i.test(clean(url))) return {html:"",url:""};
  try {
    const response=await fetchImpl(url,{headers:{"user-agent":"WIS-Public-Business-Research/1.0 (+https://wis-agency.com)"},redirect:"follow",signal:AbortSignal.timeout(15_000)});
    const type=response.headers.get("content-type")||"";
    if(!response.ok||!type.includes("text/html")) return {html:"",url:response.url||url};
    return {html:(await response.text()).slice(0,900_000),url:response.url||url};
  } catch { return {html:"",url}; }
}

async function enrichWebsite(url,fetchImpl=fetch) {
  const home=await fetchHtml(url,fetchImpl);
  if(!home.html) return extractPublishedContactSet("",home.url||url);
  let combined=home.html;
  let result=extractPublishedContactSet(combined,home.url);
  if((!result.emails.length||!result.whatsapps.length)&&result.contactLinks.length) {
    for(const link of result.contactLinks) {
      const page=await fetchHtml(link,fetchImpl);
      combined+=` ${page.html}`;
      if(combined.length>1_800_000) break;
    }
    result=extractPublishedContactSet(combined,home.url);
  }
  return result;
}

function overpassQuery(countryCode,profile) {
  const category=profile.campaignId===CORRALONES_CAMPAIGN_ID
    ? {shop:"building_materials|doityourself|hardware",name:"corralon|materiales de construccion|materiales para construccion|construcao|deposito de materiales|casa de materiales"}
    : {shop:"timber|wood|building_materials",name:"maderera|madereria|madeireira|madeiras|aserradero|serraria|lumber|timber"};
  return `[out:json][timeout:30];area["ISO3166-1"="${countryCode}"][admin_level=2]->.a;(`+
    `nwr(area.a)["name"]["website"]["shop"~"${category.shop}",i];`+
    `nwr(area.a)["name"]["contact:website"]["shop"~"${category.shop}",i];`+
    `nwr(area.a)["name"]["website"]["name"~"${category.name}",i];`+
    `nwr(area.a)["name"]["contact:website"]["name"~"${category.name}",i];`+
    `);out tags center 180;`;
}

async function fetchOverpass(countryCode,profile,fetchImpl=fetch) {
  const query=overpassQuery(countryCode,profile);
  let lastError="OVERPASS_UNAVAILABLE";
  for(const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response=await fetchImpl(endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","user-agent":"WIS-Public-Business-Research/1.0 (+https://wis-agency.com)"},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(35_000)});
      const payload=await response.json();
      if(!response.ok) throw new Error(`OVERPASS_${response.status}`);
      return {elements:payload.elements||[],endpoint};
    } catch(error) { lastError=error.message||lastError; }
  }
  throw new Error(lastError);
}

function websiteFromTags(tags={}) {
  const raw=clean(tags.website||tags["contact:website"]);
  if(!raw) return "";
  try { return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).href; }
  catch { return ""; }
}

function locationFromElement(element,country) {
  const tags=element.tags||{};
  const parts=[tags["addr:city"]||tags["addr:town"]||tags["addr:village"],tags["addr:state"],country].map(clean).filter(Boolean);
  return [...new Set(parts)].join(", ")||country;
}

function candidateFromElement(element,country,profile) {
  const tags=element.tags||{};
  const web=websiteFromTags(tags);
  const tagEmails=normalizeEmails([tags.email,tags["contact:email"]]);
  const tagWhatsapps=normalizeWhatsapps([tags.whatsapp,tags["contact:whatsapp"]]);
  return {
    displayName:tags.name,
    formattedAddress:locationFromElement(element,country),
    websiteUri:web,
    emails:tagEmails,
    whatsapps:tagWhatsapps,
    category:[tags.shop,tags.craft,tags.industrial,tags.description].filter(Boolean).join(" "),
    tags,
    businessStatus:"OPERATIONAL",
    rubro:profile.label,
    sourceId:`osm:${element.type}:${element.id}`
  };
}

export async function runSupplierResearchBatch(options={}) {
  const {commandId,request={},existingProspects=[],appendRows=async()=>{},appendEvidence=async()=>{},shouldStop=()=>false,fetchImpl=fetch}=options;
  const profile=supplierCampaignProfile(request);
  if(!profile) return {status:"BLOCKED",reason:"SUPPLIER_CAMPAIGN_REQUIRED",rows:[]};
  const remaining=Math.max(0,Number(request.quantity||profile.target)-(existingProspects||[]).length);
  if(!remaining) return {status:"DONE",reason:"CAMPAIGN_TARGET_REACHED",rows:[],accepted:[]};
  const batchTarget=Math.max(1,Math.min(25,Number(request.batchSize||25),remaining));
  const seen=new Set((existingProspects||[]).flatMap(supplierDedupeKeys));
  const rows=[];
  const accepted=[];
  let persistedCount=0;
  const persist=async()=>{
    if(rows.length<=persistedCount) return;
    await appendRows(profile.destination,rows.slice(persistedCount));
    persistedCount=rows.length;
  };
  const finish=async(status,reason,extra={})=>{ await persist(); return {status,reason,rows,accepted,...extra}; };
  const startIndex=Math.floor((existingProspects||[]).length/Math.max(1,batchTarget))%COUNTRIES.length;
  let inspected=0;
  let consecutiveSourceFailures=0;
  for(let offset=0;offset<COUNTRIES.length&&rows.length<batchTarget;offset++) {
    if(shouldStop()) return finish(rows.length?"REVIEW":"BLOCKED","PAUSED_BY_USER");
    const [countryCode,country]=COUNTRIES[(startIndex+offset)%COUNTRIES.length];
    let source;
    try { source=await fetchOverpass(countryCode,profile,fetchImpl); }
    catch(error) {
      consecutiveSourceFailures++;
      await appendEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId,campaignId:profile.campaignId,batchId:request.batchId||commandId,prospectKey:`search:${profile.campaignId}:${countryCode}`,sourceUrl:OVERPASS_ENDPOINTS[0],evidenceType:"PUBLIC_REGISTRY_SEARCH",decision:"ERROR",detail:clean(error?.message||"OVERPASS_UNAVAILABLE").slice(0,180),score:0});
      if(consecutiveSourceFailures>=3) break;
      continue;
    }
    consecutiveSourceFailures=0;
    for(const element of source.elements) {
      if(shouldStop()) return finish(rows.length?"REVIEW":"BLOCKED","PAUSED_BY_USER");
      if(rows.length>=batchTarget||inspected>=120) break;
      const preliminary=candidateFromElement(element,country,profile);
      if(!preliminary.displayName||!preliminary.websiteUri) continue;
      const preliminaryKeys=supplierDedupeKeys(preliminary);
      if(preliminaryKeys.some(value=>seen.has(value))) continue;
      preliminaryKeys.forEach(value=>seen.add(value));
      inspected++;
      const website=await enrichWebsite(preliminary.websiteUri,fetchImpl);
      const candidate={...preliminary,emails:[...preliminary.emails,...website.emails],whatsapps:[...preliminary.whatsapps,...website.whatsapps],websiteText:website.websiteText};
      const evaluation=evaluateSupplierCandidate(candidate,profile);
      const sourceUrl=candidate.websiteUri||source.endpoint;
      await appendEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId,campaignId:profile.campaignId,batchId:request.batchId||commandId,prospectKey:supplierProspectKey(candidate),sourceUrl,evidenceType:"SUPPLIER_CANDIDATE",decision:evaluation.eligible?"ACCEPTED":"DISCARDED",detail:evaluation.reasons.join(",")||`emails=${evaluation.emails.length};whatsapps=${evaluation.whatsapps.length}`,score:evaluation.score});
      if(!evaluation.eligible) { await delay(150); continue; }
      const finalKeys=supplierDedupeKeys(candidate);
      if(finalKeys.some(value=>seen.has(value)&&!preliminaryKeys.includes(value))) continue;
      finalKeys.forEach(value=>seen.add(value));
      rows.push(supplierSheetRow(candidate,profile));
      accepted.push({...candidate,emails:evaluation.emails,whatsapps:evaluation.whatsapps,country,score:evaluation.score});
      if(rows.length-persistedCount>=5) await persist();
      await delay(250);
    }
    if(inspected>=120&&rows.length<batchTarget) break;
    await delay(1_500);
  }
  return finish(rows.length?"REVIEW":"BLOCKED",rows.length===batchTarget?"BATCH_READY":"INSUFFICIENT_VERIFIED_BOTH_CONTACTS",{inspected});
}
