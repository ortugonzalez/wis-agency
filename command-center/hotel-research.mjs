const HOUR=3_600_000;

export const HOTEL_SHEET="Hoteles_Argentina_300";
export const HOTEL_CAMPAIGN_ID="hoteles-argentina-300";
export const HOTEL_LATAM_SHEET="Hoteles_LATAM_500";
export const HOTEL_LATAM_CAMPAIGN_ID="hoteles-latam-500";
export const HOTEL_HEADERS=[
  "Rubro","Empresa","Ubicación","WhatsApp","Web","Email","Rating",
  "Reseñas analizadas","Problemas","ANALISIS NEGOCIO","Mensaje WhatsApp","Mensaje Email"
];

export const HOTEL_CAMPAIGN={
  campaignId:HOTEL_CAMPAIGN_ID,
  label:"Hoteles de Argentina",
  destination:HOTEL_SHEET,
  target:300,
  batchSize:25,
  phase:"contacts",
  country:"Argentina",
  minimumReviews:20,
  professionalOperation:true,
  zeroCostMode:true,
  minimumProvinces:12,
  maximumPerCity:45,
  writableColumns:7
};

export const HOTEL_LATAM_CAMPAIGN={
  campaignId:HOTEL_LATAM_CAMPAIGN_ID,
  label:"Hoteles de Latinoamérica",
  destination:HOTEL_LATAM_SHEET,
  target:500,
  batchSize:25,
  phase:"contacts",
  country:"Latinoamérica",
  countryFocus:["México","Colombia","Chile"],
  allocation:{"México":200,"Colombia":150,"Chile":100,"Otros LATAM":50},
  minimumReviews:20,
  professionalOperation:true,
  zeroCostMode:true,
  maximumPerCity:45,
  writableColumns:7
};

export function hotelCampaignProfile(input={}) {
  const destination=String(input.destination||"").trim();
  const campaignId=String(input.campaignId||"").trim();
  if(destination===HOTEL_LATAM_SHEET||campaignId===HOTEL_LATAM_CAMPAIGN_ID) return HOTEL_LATAM_CAMPAIGN;
  return HOTEL_CAMPAIGN;
}

export const HOTEL_SEARCH_FIELD_MASK=[
  "places.id","places.displayName","places.formattedAddress","places.businessStatus",
  "places.types","places.googleMapsUri","nextPageToken"
];

export const HOTEL_DETAILS_FIELD_MASK=[
  "id","displayName","formattedAddress","businessStatus","types","googleMapsUri",
  "nationalPhoneNumber","websiteUri","rating","userRatingCount"
];

export const ZERO_COST_SKUS={
  "places-text-search-pro":{freeMonthly:5000,safeMonthly:4000,campaignLimit:240,fieldMask:HOTEL_SEARCH_FIELD_MASK},
  "place-details-enterprise":{freeMonthly:1000,safeMonthly:800,campaignLimit:450,fieldMask:HOTEL_DETAILS_FIELD_MASK}
};

export const HOTEL_DENYLIST=[
  "four seasons","sheraton","costa galana","marriott","hilton","hyatt","sofitel","novotel","mercure","ibis",
  "accor","wyndham","howard johnson","nh hotel","nh collection","melia","meliá","radisson","amerian","amérian",
  "loi suites","alvear","dazzler","esplendor","palladio","selina","holiday inn","intercontinental","park hyatt"
];

const HOTEL_TYPES=new Set(["hotel","lodging","resort_hotel","extended_stay_hotel"]);
const PROFESSIONAL_SIGNALS=[
  /recepci[oó]n\s*(?:las\s*)?24/i,
  /(?:motor|sistema|reservas?)\s+(?:de\s+)?(?:reservas?|online)/i,
  /(?:habitaciones?|suites?)\s+(?:dobles?|triples?|familiares?|superiores?|deluxe)/i,
  /(?:restaurante|desayuno|bar)\b/i,
  /(?:eventos?|sal[oó]n|convenciones?|corporativ)/i,
  /(?:spa|gimnasio|piscina|estacionamiento|room service)/i
];

const text=value=>String(value??"").trim();
const fold=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");

export function hotelProspectKey(candidate={}) {
  const domain=websiteDomain(candidate.web||candidate.websiteUri);
  const phone=normalizePhone(candidate.whatsapp||candidate.phone||candidate.nationalPhoneNumber);
  const placeId=text(candidate.placeId||candidate.id);
  if(placeId) return `place:${placeId}`;
  if(domain) return `domain:${domain}`;
  if(phone) return `phone:${phone}`;
  return `name:${fold(candidate.empresa||candidate.displayName)}|${fold(candidate.ubicacion||candidate.formattedAddress)}`;
}

export function hotelDedupeKeys(candidate={}) {
  const keys=[];
  const placeId=text(candidate.placeId||candidate.id);
  const domain=websiteDomain(candidate.web||candidate.websiteUri);
  const phone=normalizePhone(candidate.whatsapp||candidate.phone||candidate.nationalPhoneNumber);
  const email=text(candidate.email).toLowerCase();
  const name=fold(candidate.empresa||candidate.displayName);
  const location=fold(candidate.ubicacion||candidate.formattedAddress);
  if(placeId) keys.push(`place:${placeId}`);
  if(domain) keys.push(`domain:${domain}`);
  if(phone) keys.push(`phone:${phone}`);
  if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) keys.push(`email:${email}`);
  if(name&&location) keys.push(`name:${name}|${location}`);
  return keys;
}

export function websiteDomain(value) {
  try { return new URL(/^https?:\/\//i.test(text(value))?text(value):`https://${text(value)}`).hostname.replace(/^www\./i,"").toLowerCase(); }
  catch { return ""; }
}

export function normalizePhone(value) {
  const raw=text(value);
  const digits=raw.replace(/\D/g,"");
  return digits.length>=8&&digits.length<=15?digits:"";
}

export function isExplicitWhatsapp(value,source="") {
  const combined=`${text(value)} ${text(source)}`;
  return Boolean(normalizePhone(value))&&/(?:wa\.me\/|api\.whatsapp\.com\/|whatsapp)/i.test(combined);
}

export function isPublishedEmail(value,source="") {
  const email=text(value).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return /mailto:/i.test(source)||fold(source).includes(email)||Boolean(websiteDomain(source));
}

export function validatePlacesFieldMask(kind,fields=[]) {
  const service=kind==="details"?"place-details-enterprise":"places-text-search-pro";
  const allowed=new Set(ZERO_COST_SKUS[service].fieldMask);
  const normalized=Array.isArray(fields)?fields.map(text).filter(Boolean):text(fields).split(",").map(text).filter(Boolean);
  if(!normalized.length) throw new Error("PLACES_FIELD_MASK_REQUIRED");
  if(normalized.includes("*")||normalized.some(field=>/reviews?|reviewSummary|generativeSummary|editorialSummary|routingSummaries/i.test(field))) throw new Error("PLACES_EXPENSIVE_FIELD_BLOCKED");
  if(normalized.some(field=>!allowed.has(field))) throw new Error("PLACES_FIELD_NOT_ALLOWLISTED");
  return normalized.join(",");
}

function metadata(record={}) {
  if(record.metadata&&typeof record.metadata==="object") return record.metadata;
  try { return JSON.parse(record.metadata||"{}"); } catch { return {}; }
}

function month(value) {
  const date=new Date(value);
  return Number.isFinite(date.getTime())?`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`:"";
}

export function buildZeroCostGuard(records=[],providerUsage={},now=new Date(),campaignId=HOTEL_CAMPAIGN_ID) {
  const observedAt=new Date(providerUsage.observedAt||providerUsage.observed_at||0);
  const ageMs=now.getTime()-observedAt.getTime();
  const verified=Number.isFinite(observedAt.getTime())&&ageMs>=0&&ageMs<=6*HOUR;
  const currentMonth=month(now);
  const services={};
  for(const [service,policy] of Object.entries(ZERO_COST_SKUS)) {
    const local=(records||[]).filter(row=>month(row.timestamp)===currentMonth&&String(row.service||"").toLowerCase()===service)
      .reduce((sum,row)=>sum+Math.max(0,Number(row.units)||0),0);
    const campaign=(records||[]).filter(row=>month(row.timestamp)===currentMonth&&String(row.service||"").toLowerCase()===service&&metadata(row).campaignId===campaignId)
      .reduce((sum,row)=>sum+Math.max(0,Number(row.units)||0),0);
    const observed=Math.max(0,Number(providerUsage[service]??providerUsage.services?.[service]?.used)||0);
    const used=Math.max(local,observed);
    const safeRemaining=Math.max(0,policy.safeMonthly-used);
    const campaignRemaining=Math.max(0,policy.campaignLimit-campaign);
    services[service]={...policy,used,local,observed,campaignUsed:campaign,remaining:Math.min(safeRemaining,campaignRemaining)};
  }
  const exhausted=Object.values(services).some(row=>row.remaining<=0);
  return {
    campaignId,
    zeroCostMode:true,
    status:!verified?"UNVERIFIED":exhausted?"BLOCKED":"CONFIRMED_ZERO",
    verified,
    observedAt:verified?observedAt.toISOString():null,
    safetyMarginPct:20,
    services,
    reason:!verified?"PROVIDER_USAGE_UNVERIFIED":exhausted?"ZERO_COST_CAP":"WITHIN_FREE_QUOTA"
  };
}

export function authorizeZeroCostUnit(guard,service,units=1) {
  const requested=Math.max(1,Math.trunc(Number(units)||1));
  const state=guard?.services?.[service];
  if(!guard?.verified) return {allowed:false,reason:"PROVIDER_USAGE_UNVERIFIED",fallback:"BROWSER_PUBLIC_SOURCES"};
  if(!state) return {allowed:false,reason:"SKU_NOT_ALLOWED"};
  if(requested>state.remaining) return {allowed:false,reason:"ZERO_COST_CAP",fallback:"BROWSER_PUBLIC_SOURCES"};
  return {allowed:true,reason:"CONFIRMED_ZERO",service,units:requested,remainingAfter:state.remaining-requested};
}

export function hotelOperationSignals(candidate={}) {
  const evidence=[candidate.description,candidate.websiteText,candidate.services,candidate.notes].filter(Boolean).join(" ");
  const matched=PROFESSIONAL_SIGNALS.filter(pattern=>pattern.test(evidence)).map(pattern=>pattern.source);
  const rooms=Math.max(0,Number(candidate.rooms)||0);
  return {rooms,signals:matched.length,professional:rooms>=20||matched.length>=2};
}

export function evaluateHotelCandidate(candidate={}) {
  const name=fold(candidate.empresa||candidate.displayName);
  const combined=fold(`${candidate.empresa||candidate.displayName} ${candidate.web||candidate.websiteUri}`);
  const types=new Set(candidate.types||[]);
  const reviews=Math.max(0,Number(candidate.reviewCount||candidate.userRatingCount)||0);
  const operation=hotelOperationSignals(candidate);
  const emailOk=isPublishedEmail(candidate.email,candidate.emailSource||candidate.web||candidate.websiteUri);
  const whatsappOk=isExplicitWhatsapp(candidate.whatsapp,candidate.whatsappSource);
  const reasons=[];
  if(!name) reasons.push("NAME_REQUIRED");
  if(candidate.businessStatus&&candidate.businessStatus!=="OPERATIONAL") reasons.push("NOT_OPERATIONAL");
  if(types.size&&!Array.from(types).some(type=>HOTEL_TYPES.has(type))) reasons.push("TYPE_NOT_HOTEL");
  if(/\b(hostel|alquiler temporario|departamento|casa particular|cabañas?)\b/i.test(combined)) reasons.push("EXCLUDED_LODGING_TYPE");
  if(HOTEL_DENYLIST.some(brand=>combined.includes(fold(brand)))) reasons.push("EXCLUDED_BRAND");
  if(Number(candidate.rooms)>=150||candidate.enterprise===true||candidate.centralizedSales===true) reasons.push("ENTERPRISE_PROPERTY");
  if(reviews<20) reasons.push("INSUFFICIENT_REVIEWS");
  if(!operation.professional) reasons.push("PROFESSIONAL_OPERATION_UNVERIFIED");
  if(!emailOk&&!whatsappOk) reasons.push("VERIFIED_CONTACT_REQUIRED");
  const contactScore=emailOk&&whatsappOk?30:18;
  const operationScore=Math.min(25,(operation.rooms>=20?15:0)+Math.min(10,operation.signals*5));
  const accessibilityScore=candidate.independent===false?0:candidate.regionalPropertyCount&&candidate.regionalPropertyCount<=5?16:20;
  const digitalScore=Math.min(15,(candidate.web||candidate.websiteUri?8:0)+(candidate.bookingEngine?7:0));
  const activityScore=reviews>=100?10:reviews>=50?8:reviews>=20?6:0;
  return {eligible:reasons.length===0,reasons,score:contactScore+operationScore+accessibilityScore+digitalScore+activityScore,operation,emailOk,whatsappOk};
}

export function hotelSheetRow(candidate={}) {
  const evaluation=evaluateHotelCandidate(candidate);
  if(!evaluation.eligible) throw Object.assign(new Error("HOTEL_CANDIDATE_NOT_ELIGIBLE"),{reasons:evaluation.reasons});
  return [
    text(candidate.rubro||candidate.subtype||"Hotel independiente"),
    text(candidate.empresa||candidate.displayName),
    text(candidate.ubicacion||candidate.formattedAddress),
    evaluation.whatsappOk?text(candidate.whatsapp):"",
    text(candidate.web||candidate.websiteUri),
    evaluation.emailOk?text(candidate.email).toLowerCase():"",
    text(candidate.rating),"","","","",""
  ];
}
