export const CORRALONES_SHEET="Corralones_LATAM_1000";
export const CORRALONES_CAMPAIGN_ID="corralones-latam-1000";
export const MADERERAS_SHEET="Madereras_LATAM_1000";
export const MADERERAS_CAMPAIGN_ID="madereras-latam-1000";

export const SUPPLIER_HEADERS=[
  "Rubro","Empresa","Ubicación","WhatsApp","Web","Email","Rating",
  "Reseñas analizadas","Problemas","ANALISIS NEGOCIO","Mensaje WhatsApp","Mensaje Email"
];

const COMMON={
  target:1000,
  batchSize:25,
  phase:"contacts",
  country:"Latinoamérica",
  contact:"both",
  requireBothContacts:true,
  zeroCostMode:true,
  writableColumns:7,
  sourceStrategy:"PUBLIC_REGISTRIES_AND_OFFICIAL_WEBSITES"
};

export const CORRALONES_CAMPAIGN={
  ...COMMON,
  campaignId:CORRALONES_CAMPAIGN_ID,
  label:"Corralones y materiales de construcción",
  destination:CORRALONES_SHEET,
  businessType:"corralones",
  industry:"Materiales para la construcción"
};

export const MADERERAS_CAMPAIGN={
  ...COMMON,
  campaignId:MADERERAS_CAMPAIGN_ID,
  label:"Madereras y aserraderos",
  destination:MADERERAS_SHEET,
  businessType:"madereras",
  industry:"Maderas y derivados"
};

export const SUPPLIER_CAMPAIGN_IDS=new Set([CORRALONES_CAMPAIGN_ID,MADERERAS_CAMPAIGN_ID]);
export const SUPPLIER_SHEETS=new Set([CORRALONES_SHEET,MADERERAS_SHEET]);

const LARGE_CHAIN_DENYLIST=[
  "sodimac","homecenter","the home depot","home depot","lowe's","lowes","easy argentina","easy chile",
  "construmart","madecentro","leroy merlin","telhanorte","cassol centerlar","tumelero"
];

const text=value=>String(value??"").trim();
const fold=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");

export function supplierCampaignProfile(input={}) {
  const destination=text(input.destination);
  const campaignId=text(input.campaignId);
  const businessType=fold(input.businessType);
  if(destination===MADERERAS_SHEET||campaignId===MADERERAS_CAMPAIGN_ID||businessType==="madereras") return MADERERAS_CAMPAIGN;
  if(destination===CORRALONES_SHEET||campaignId===CORRALONES_CAMPAIGN_ID||businessType==="corralones") return CORRALONES_CAMPAIGN;
  return null;
}

export function websiteDomain(value) {
  try { return new URL(/^https?:\/\//i.test(text(value))?text(value):`https://${text(value)}`).hostname.replace(/^www\./i,"").toLowerCase(); }
  catch { return ""; }
}

function splitRaw(value) {
  return (Array.isArray(value)?value:[value]).flatMap(item=>text(item).split(/[\n;,]+/)).map(text).filter(Boolean);
}

export function normalizeEmails(value) {
  return [...new Set(splitRaw(value).map(item=>item.replace(/^mailto:/i,"").split(/[?&#]/)[0].toLowerCase()).filter(item=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))];
}

export function normalizeWhatsapps(value) {
  const result=[];
  for(const item of splitRaw(value)) {
    const match=item.match(/(?:wa\.me\/|phone=)?\+?(\d{8,15})/i);
    if(match) result.push(`+${match[1]}`);
  }
  return [...new Set(result)];
}

export function supplierProspectKey(candidate={}) {
  const domain=websiteDomain(candidate.web||candidate.websiteUri);
  const whatsapp=normalizeWhatsapps(candidate.whatsapp||candidate.whatsapps)[0]||"";
  const email=normalizeEmails(candidate.email||candidate.emails)[0]||"";
  if(domain) return `domain:${domain}`;
  if(email) return `email:${email}`;
  if(whatsapp) return `phone:${whatsapp.replace(/\D/g,"")}`;
  return `name:${fold(candidate.empresa||candidate.displayName)}|${fold(candidate.ubicacion||candidate.formattedAddress)}`;
}

export function supplierDedupeKeys(candidate={}) {
  const keys=[];
  const domain=websiteDomain(candidate.web||candidate.websiteUri);
  const name=fold(candidate.empresa||candidate.displayName);
  const location=fold(candidate.ubicacion||candidate.formattedAddress);
  if(domain) keys.push(`domain:${domain}`);
  normalizeEmails(candidate.email||candidate.emails).forEach(email=>keys.push(`email:${email}`));
  normalizeWhatsapps(candidate.whatsapp||candidate.whatsapps).forEach(phone=>keys.push(`phone:${phone.replace(/\D/g,"")}`));
  if(name&&location) keys.push(`name:${name}|${location}`);
  return keys;
}

function categoryMatches(candidate,profile) {
  const haystack=fold([
    candidate.empresa,candidate.displayName,candidate.websiteText,candidate.category,
    candidate.tags?.shop,candidate.tags?.craft,candidate.tags?.industrial
  ].filter(Boolean).join(" "));
  if(profile.campaignId===CORRALONES_CAMPAIGN_ID) return /(corralon|materiales? de construccion|construcao|construccion|building materials|deposito de materiales|ferreteria|hardware|casa de materiales)/i.test(haystack);
  return /(maderera|madereria|madeireira|madeiras|aserradero|serraria|lumber|timber|maderas? y derivados|venta de madera)/i.test(haystack);
}

export function evaluateSupplierCandidate(candidate={},profileInput={}) {
  const profile=profileInput.campaignId?profileInput:supplierCampaignProfile(profileInput);
  if(!profile) return {eligible:false,reasons:["SUPPLIER_CAMPAIGN_REQUIRED"],emails:[],whatsapps:[]};
  const name=text(candidate.empresa||candidate.displayName);
  const web=text(candidate.web||candidate.websiteUri);
  const emails=normalizeEmails(candidate.email||candidate.emails);
  const whatsapps=normalizeWhatsapps(candidate.whatsapp||candidate.whatsapps);
  const combined=fold(`${name} ${web}`);
  const reasons=[];
  if(!name) reasons.push("NAME_REQUIRED");
  if(!websiteDomain(web)) reasons.push("OFFICIAL_WEB_REQUIRED");
  if(candidate.businessStatus&&candidate.businessStatus!=="OPERATIONAL") reasons.push("NOT_OPERATIONAL");
  if(profile.requireBothContacts&&(!emails.length||!whatsapps.length)) reasons.push("EMAIL_AND_WHATSAPP_REQUIRED");
  if(profile.campaignId===CORRALONES_CAMPAIGN_ID&&!categoryMatches(candidate,profile)) reasons.push("CATEGORY_MISMATCH_CORRALON");
  if(profile.campaignId===MADERERAS_CAMPAIGN_ID&&!categoryMatches(candidate,profile)) reasons.push("CATEGORY_MISMATCH_MADERERA");
  if(LARGE_CHAIN_DENYLIST.some(brand=>combined.includes(fold(brand)))||candidate.enterprise===true||candidate.centralizedSales===true) reasons.push("LARGE_CHAIN_EXCLUDED");
  const contactScore=emails.length&&whatsapps.length?50:0;
  const webScore=websiteDomain(web)?20:0;
  const categoryScore=categoryMatches(candidate,profile)?20:0;
  const accessibilityScore=candidate.enterprise===true?0:10;
  return {eligible:reasons.length===0,reasons,score:contactScore+webScore+categoryScore+accessibilityScore,emails,whatsapps};
}

export function supplierSheetRow(candidate={},profileInput={}) {
  const profile=profileInput.campaignId?profileInput:supplierCampaignProfile(profileInput);
  const evaluation=evaluateSupplierCandidate(candidate,profile);
  if(!evaluation.eligible) throw Object.assign(new Error("SUPPLIER_CANDIDATE_NOT_ELIGIBLE"),{reasons:evaluation.reasons});
  return [
    text(candidate.rubro||profile.label),
    text(candidate.empresa||candidate.displayName),
    text(candidate.ubicacion||candidate.formattedAddress),
    evaluation.whatsapps.join("\n"),
    text(candidate.web||candidate.websiteUri),
    evaluation.emails.join("\n"),
    text(candidate.rating),"","","","",""
  ];
}
