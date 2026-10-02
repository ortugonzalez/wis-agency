import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  authorizeZeroCostUnit,
  evaluateHotelCandidate,
  hotelDedupeKeys,
  hotelProspectKey,
  hotelSheetRow,
  HOTEL_CAMPAIGN_ID,
  HOTEL_DENYLIST,
  HOTEL_DETAILS_FIELD_MASK,
  HOTEL_SEARCH_FIELD_MASK,
  HOTEL_SHEET,
  HOTEL_LATAM_CAMPAIGN_ID,
  HOTEL_LATAM_SHEET,
  hotelCampaignProfile,
  validatePlacesFieldMask
} from "./hotel-research.mjs";

export const HOTEL_DESTINATIONS=[
  ["Ciudad de Buenos Aires","CABA"],["Mar del Plata","Buenos Aires"],["Tandil","Buenos Aires"],["Cariló","Buenos Aires"],
  ["La Plata","Buenos Aires"],["Córdoba","Córdoba"],["Villa Carlos Paz","Córdoba"],["Villa General Belgrano","Córdoba"],
  ["Rosario","Santa Fe"],["Santa Fe","Santa Fe"],["Paraná","Entre Ríos"],["Colón","Entre Ríos"],["Mendoza","Mendoza"],
  ["San Rafael","Mendoza"],["San Juan","San Juan"],["Merlo","San Luis"],["Salta","Salta"],["Cafayate","Salta"],
  ["San Miguel de Tucumán","Tucumán"],["San Salvador de Jujuy","Jujuy"],["Purmamarca","Jujuy"],
  ["Puerto Iguazú","Misiones"],["Posadas","Misiones"],["Resistencia","Chaco"],["Corrientes","Corrientes"],
  ["San Carlos de Bariloche","Río Negro"],["Villa La Angostura","Neuquén"],["San Martín de los Andes","Neuquén"],
  ["Ushuaia","Tierra del Fuego"],["El Calafate","Santa Cruz"],["Puerto Madryn","Chubut"],["Esquel","Chubut"]
];

// 40/30/20/10 mirrors the fixed 200/150/100/50 allocation at a 500-record target.
export const HOTEL_LATAM_DESTINATIONS=[
  ["Ciudad de México","CDMX","México","MX"],["Guadalajara","Jalisco","México","MX"],
  ["Monterrey","Nuevo León","México","MX"],["Puebla","Puebla","México","MX"],
  ["Querétaro","Querétaro","México","MX"],["Mérida","Yucatán","México","MX"],
  ["Oaxaca de Juárez","Oaxaca","México","MX"],["San Miguel de Allende","Guanajuato","México","MX"],
  ["Bogotá","Cundinamarca","Colombia","CO"],["Medellín","Antioquia","Colombia","CO"],
  ["Cali","Valle del Cauca","Colombia","CO"],["Cartagena","Bolívar","Colombia","CO"],
  ["Barranquilla","Atlántico","Colombia","CO"],["Pereira","Risaralda","Colombia","CO"],
  ["Santiago","Región Metropolitana","Chile","CL"],["Valparaíso","Valparaíso","Chile","CL"],
  ["Viña del Mar","Valparaíso","Chile","CL"],["Puerto Varas","Los Lagos","Chile","CL"],
  ["Lima","Lima","Perú","PE"],["Montevideo","Montevideo","Uruguay","UY"]
];

const clean=value=>String(value??"").trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function configuredMapsApiKey() {
  const direct=clean(process.env.GOOGLE_MAPS_API_KEY);
  if(direct) return direct;
  const secretFile=clean(process.env.GOOGLE_MAPS_API_KEY_FILE);
  if(!secretFile) return "";
  try { return clean(readFileSync(secretFile,"utf8")); }
  catch { return ""; }
}

function htmlText(html) {
  return clean(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").slice(0,120_000);
}

function linkValues(html,baseUrl) {
  const values=[];
  for(const match of String(html||"").matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try { values.push(new URL(match[1],baseUrl).href); } catch { /* ignore invalid public link */ }
  }
  return values;
}

export function extractPublishedContacts(html,pageUrl) {
  const links=linkValues(html,pageUrl);
  const mailto=links.find(link=>/^mailto:/i.test(link));
  const whatsapp=links.find(link=>/(?:wa\.me\/|api\.whatsapp\.com\/)/i.test(link));
  const visible=htmlText(html);
  const rawEmailCandidate=mailto?.replace(/^mailto:/i,"").split(/[?&#]/)[0]||visible.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||"";
  let emailCandidate=clean(rawEmailCandidate);
  try { emailCandidate=clean(decodeURIComponent(emailCandidate)); } catch { /* preserve readable mailto */ }
  let pageHost="";
  try { pageHost=new URL(pageUrl).hostname.replace(/^www\./i,"").toLowerCase(); } catch { /* invalid source URL */ }
  const emailDomain=clean(emailCandidate).split("@")[1]?.toLowerCase()||"";
  const publicMailDomains=new Set(["gmail.com","hotmail.com","outlook.com","yahoo.com","live.com"]);
  const localCompact=emailCandidate.split("@")[0]?.replace(/[^a-z0-9]/gi,"").toLowerCase()||"";
  const hostCompact=(pageHost.split(".")[0]||"").replace(/[^a-z0-9]/gi,"").toLowerCase();
  let commonPrefix=0;
  while(commonPrefix<localCompact.length&&commonPrefix<hostCompact.length&&localCompact[commonPrefix]===hostCompact[commonPrefix]) commonPrefix++;
  const publicMailboxMatches=publicMailDomains.has(emailDomain)&&(localCompact.includes(hostCompact)||hostCompact.includes(localCompact)||commonPrefix>=6);
  const domainMatches=Boolean(emailDomain&&(publicMailboxMatches||pageHost===emailDomain||pageHost.endsWith(`.${emailDomain}`)||emailDomain.endsWith(`.${pageHost}`)));
  const email=domainMatches?emailCandidate:"";
  const waDigits=whatsapp?.match(/(?:wa\.me\/|phone=)(\d{8,15})/i)?.[1]||"";
  const rooms=Number(visible.match(/\b(\d{2,3})\s+(?:habitaciones?|rooms?)\b/i)?.[1]||0);
  return {
    email:clean(email).toLowerCase(),
    emailSource:mailto||email?pageUrl:"",
    whatsapp:waDigits?`+${waDigits}`:"",
    whatsappSource:whatsapp||"",
    websiteText:visible,
    rooms,
    bookingEngine:/(?:reservar ahora|reservas online|book now|motor de reservas)/i.test(visible),
    contactLinks:links.filter(link=>{
      if(!/(?:contacto|contact|reservas|booking)/i.test(link)) return false;
      try { return new URL(link).hostname.replace(/^www\./i,"").toLowerCase()===pageHost; }
      catch { return false; }
    }).slice(0,2)
  };
}

async function fetchHtml(url,fetchImpl=fetch) {
  if(!/^https?:\/\//i.test(clean(url))) return {html:"",url:""};
  try {
    const response=await fetchImpl(url,{headers:{"user-agent":"WIS-Prospect-Research/1.0 (+https://wis-agency.com)"},redirect:"follow",signal:AbortSignal.timeout(12_000)});
    const type=response.headers.get("content-type")||"";
    if(!response.ok||!type.includes("text/html")) return {html:"",url:response.url||url};
    return {html:(await response.text()).slice(0,800_000),url:response.url||url};
  } catch { return {html:"",url}; }
}

async function enrichWebsite(url,fetchImpl=fetch) {
  const home=await fetchHtml(url,fetchImpl);
  if(!home.html) return extractPublishedContacts("",home.url||url);
  let combined=home.html;
  const contacts=extractPublishedContacts(home.html,home.url);
  if((!contacts.email||!contacts.whatsapp)&&contacts.contactLinks.length) {
    for(const link of contacts.contactLinks) {
      const page=await fetchHtml(link,fetchImpl);
      combined+=` ${page.html}`;
      if(combined.length>1_200_000) break;
    }
  }
  return extractPublishedContacts(combined,home.url);
}

async function enrichWebsiteBounded(url,fetchImpl=fetch) {
  const timeout=delay(18_000).then(()=>({...extractPublishedContacts("",url),websiteTimeout:true}));
  return Promise.race([enrichWebsite(url,fetchImpl),timeout]);
}

async function placesPost(apiKey,path,body,fieldMask,fetchImpl=fetch) {
  const response=await fetchImpl(`https://places.googleapis.com/v1/${path}`,{
    method:"POST",headers:{"content-type":"application/json","x-goog-api-key":apiKey,"x-goog-fieldmask":fieldMask},
    body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)
  });
  const payload=await response.json();
  if(!response.ok) throw new Error(`PLACES_REQUEST_FAILED_${response.status}`);
  return payload;
}

async function placeDetails(apiKey,placeId,fieldMask,fetchImpl=fetch) {
  const response=await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,{
    headers:{"x-goog-api-key":apiKey,"x-goog-fieldmask":fieldMask},signal:AbortSignal.timeout(20_000)
  });
  const payload=await response.json();
  if(!response.ok) throw new Error(`PLACES_DETAILS_FAILED_${response.status}`);
  return payload;
}

function subtype(place={}) {
  const value=`${place.displayName?.text||""} ${(place.types||[]).join(" ")}`.toLowerCase();
  if(/apart/.test(value)) return "Apart hotel";
  if(/hoster[ií]a/.test(value)) return "Hostería";
  if(/boutique/.test(value)) return "Hotel boutique";
  return "Hotel independiente";
}

export async function runHotelResearchBatch(options={}) {
  const {
    commandId,request={},existingProspects=[],guard,apiKey=configuredMapsApiKey(),
    reserveCost=async()=>{},appendRows=async()=>{},appendEvidence=async()=>{},shouldStop=()=>false,fetchImpl=fetch
  }=options;
  const profile=hotelCampaignProfile(request);
  const campaignId=profile.campaignId;
  const destinationSheet=profile.destination;
  const destinations=campaignId===HOTEL_LATAM_CAMPAIGN_ID?HOTEL_LATAM_DESTINATIONS:HOTEL_DESTINATIONS.map(([city,region])=>[city,region,"Argentina","AR"]);
  const remaining=Math.max(0,Number(request.quantity||profile.target)-(existingProspects||[]).length);
  if(!remaining) return {status:"DONE",reason:"CAMPAIGN_TARGET_REACHED",rows:[],accepted:[]};
  const batchTarget=Math.max(1,Math.min(25,Number(request.batchSize||25),remaining));
  if(!apiKey) return {status:"BLOCKED",reason:"GOOGLE_MAPS_API_KEY_MISSING",fallback:"BROWSER_PUBLIC_SOURCES",rows:[]};
  const searchAuthorization=authorizeZeroCostUnit(guard,"places-text-search-pro",1);
  const detailsAuthorization=authorizeZeroCostUnit(guard,"place-details-enterprise",1);
  if(!searchAuthorization.allowed||!detailsAuthorization.allowed) return {status:"BLOCKED",reason:searchAuthorization.reason||detailsAuthorization.reason,fallback:"BROWSER_PUBLIC_SOURCES",rows:[]};
  const searchMask=validatePlacesFieldMask("search",HOTEL_SEARCH_FIELD_MASK);
  const detailsMask=validatePlacesFieldMask("details",HOTEL_DETAILS_FIELD_MASK);
  const reservations={"places-text-search-pro":0,"place-details-enterprise":0};
  const seen=new Set((existingProspects||[]).flatMap(hotelDedupeKeys));
  const rows=[];
  const accepted=[];
  const cityCounts=new Map();
  const batchCityCounts=new Map();
  for(const prospect of existingProspects||[]) {
    const location=clean(prospect.ubicacion||prospect.location).toLowerCase();
    for(const [city] of destinations) if(location.includes(city.toLowerCase())) cityCounts.set(city,(cityCounts.get(city)||0)+1);
  }
  let persistedCount=0;
  const persist=async()=>{
    if(rows.length<=persistedCount) return;
    await appendRows(destinationSheet,rows.slice(persistedCount));
    persistedCount=rows.length;
  };
  const finish=async(status,reason,extra={})=>{
    await persist();
    return {status,reason,rows,accepted,...extra};
  };
  const startIndex=Math.floor((existingProspects||[]).length/Math.max(1,batchTarget))%destinations.length;
  for(let offset=0;offset<destinations.length&&rows.length<batchTarget;offset++) {
    if(shouldStop()) return finish(rows.length?"REVIEW":"BLOCKED","PAUSED_BY_USER");
    const [city,province,country,regionCode]=destinations[(startIndex+offset)%destinations.length];
    if((cityCounts.get(city)||0)>=45) continue;
    const searchUnit=authorizeZeroCostUnit(guard,"places-text-search-pro",reservations["places-text-search-pro"]+1);
    if(!searchUnit.allowed) return finish(rows.length?"REVIEW":"BLOCKED",searchUnit.reason,{fallback:"BROWSER_PUBLIC_SOURCES"});
    await reserveCost("places-text-search-pro",{commandId,city,province,country,campaignId,batchId:request.batchId});
    reservations["places-text-search-pro"]++;
    let search;
    try {
      search=await placesPost(apiKey,"places:searchText",{textQuery:`hotel independiente en ${city}, ${province}, ${country}`,includedType:"hotel",strictTypeFiltering:true,pageSize:20,languageCode:"es",regionCode},searchMask,fetchImpl);
    } catch(error) {
      await appendEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId,campaignId,batchId:request.batchId||commandId,prospectKey:`search:${country.toLowerCase()}:${city.toLowerCase()}`,sourceUrl:"https://places.googleapis.com/v1/places:searchText",evidenceType:"HOTEL_SEARCH",decision:"ERROR",detail:String(error?.message||"SEARCH_FAILED").slice(0,180),score:0});
      continue;
    }
    for(const place of search.places||[]) {
      if(shouldStop()) return finish(rows.length?"REVIEW":"BLOCKED","PAUSED_BY_USER");
      if(rows.length>=batchTarget) break;
      if((batchCityCounts.get(city)||0)>=5) break;
      const preliminary={id:place.id,displayName:place.displayName?.text,formattedAddress:place.formattedAddress,types:place.types,businessStatus:place.businessStatus,websiteUri:"",independent:true};
      const preliminaryName=clean(preliminary.displayName).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      if(/\b(hostel|alquiler temporario|departamento|casa particular|cabanas?)\b/i.test(preliminaryName)||HOTEL_DENYLIST.some(brand=>preliminaryName.includes(clean(brand).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()))) {
        await appendEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId,campaignId,batchId:request.batchId||commandId,prospectKey:`place:${place.id}`,sourceUrl:place.googleMapsUri,evidenceType:"HOTEL_CANDIDATE",decision:"DISCARDED",detail:"PRELIMINARY_EXCLUSION",score:0});
        await delay(1_000);
        continue;
      }
      const preliminaryKeys=hotelDedupeKeys(preliminary);
      if(preliminaryKeys.some(key=>seen.has(key))) continue;
      preliminaryKeys.forEach(key=>seen.add(key));
      const detailUnit=authorizeZeroCostUnit(guard,"place-details-enterprise",reservations["place-details-enterprise"]+1);
      if(!detailUnit.allowed) return finish(rows.length?"REVIEW":"BLOCKED",detailUnit.reason,{fallback:"BROWSER_PUBLIC_SOURCES"});
      await reserveCost("place-details-enterprise",{commandId,placeId:place.id,city,province,country,campaignId,batchId:request.batchId});
      reservations["place-details-enterprise"]++;
      let detail;
      try {
        detail=await placeDetails(apiKey,place.id,detailsMask,fetchImpl);
      } catch(error) {
        await appendEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId,campaignId,batchId:request.batchId||commandId,prospectKey:`place:${place.id}`,sourceUrl:place.googleMapsUri||"https://places.googleapis.com/",evidenceType:"HOTEL_CANDIDATE",decision:"ERROR",detail:String(error?.message||"DETAILS_FAILED").slice(0,180),score:0});
        continue;
      }
      const web=await enrichWebsiteBounded(detail.websiteUri,fetchImpl);
      const candidate={
        id:detail.id||place.id,displayName:detail.displayName?.text||place.displayName?.text,formattedAddress:detail.formattedAddress||place.formattedAddress,
        types:detail.types||place.types,businessStatus:detail.businessStatus||place.businessStatus,websiteUri:detail.websiteUri,
        rating:detail.rating,userRatingCount:detail.userRatingCount,nationalPhoneNumber:detail.nationalPhoneNumber,
        independent:true,subtype:subtype(detail),...web
      };
      const candidateKeys=hotelDedupeKeys(candidate);
      if(candidateKeys.some(key=>seen.has(key)&&!preliminaryKeys.includes(key))) {
        await appendEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId,campaignId,batchId:request.batchId||commandId,prospectKey:hotelProspectKey(candidate),sourceUrl:detail.websiteUri||detail.googleMapsUri||place.googleMapsUri,evidenceType:"HOTEL_CANDIDATE",decision:"DISCARDED",detail:"DUPLICATE_CONTACT_OR_DOMAIN",score:0});
        continue;
      }
      candidateKeys.forEach(key=>seen.add(key));
      const evaluation=evaluateHotelCandidate(candidate);
      await appendEvidence({evidenceId:`EVD-${Date.now()}-${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),commandId,campaignId,batchId:request.batchId||commandId,prospectKey:hotelProspectKey(candidate),sourceUrl:detail.websiteUri||detail.googleMapsUri||place.googleMapsUri,evidenceType:"HOTEL_CANDIDATE",decision:evaluation.eligible?"ACCEPTED":"DISCARDED",detail:evaluation.reasons.join(",")||`rooms=${evaluation.operation.rooms};signals=${evaluation.operation.signals}`,score:evaluation.score});
      await delay(1_000);
      if(!evaluation.eligible) continue;
      rows.push(hotelSheetRow(candidate));
      accepted.push({...candidate,score:evaluation.score,city,province,country});
      cityCounts.set(city,(cityCounts.get(city)||0)+1);
      batchCityCounts.set(city,(batchCityCounts.get(city)||0)+1);
      if(rows.length-persistedCount>=5) await persist();
      await delay(120);
    }
  }
  return finish(rows.length?"REVIEW":"BLOCKED",rows.length===batchTarget?"BATCH_READY":"INSUFFICIENT_VERIFIED_CONTACTS");
}
