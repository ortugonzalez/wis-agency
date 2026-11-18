const ACCEPTED_DECISIONS=new Set(["ACCEPTED","VERIFIED"]);
const PROSPECT_KEY=/^WIS-P-\d{6}$/;
const EMAIL_PATTERN=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN=/\+?\d[\d\s().-]{6,}\d/g;
const WHATSAPP_HOSTS=new Set(["wa.me","api.whatsapp.com"]);
const SOCIAL_HOSTS=new Set(["instagram.com","facebook.com","fb.com"]);

function text(value) {
  return String(value??"").trim();
}

function validTimestamp(value) {
  const parsed=Date.parse(text(value));
  return Number.isFinite(parsed)&&parsed<=Date.now()+5*60_000;
}

function validOfficialSource(value) {
  try {
    const url=new URL(text(value));
    return url.protocol==="https:"&&Boolean(url.hostname)&&!/(^|\.)(google\.|bing\.|duckduckgo\.)/i.test(url.hostname);
  } catch { return false; }
}

function normalizedHost(value) {
  try {
    return new URL(text(value)).hostname.toLowerCase().replace(/^(www\.|m\.)/,"");
  } catch { return ""; }
}

function hostMatches(left,right) {
  return Boolean(left&&right&&(left===right||left.endsWith(`.${right}`)||right.endsWith(`.${left}`)));
}

function normalizedPath(value) {
  try {
    const path=new URL(text(value)).pathname.replace(/\/+$/g,"").toLowerCase();
    return path||"/";
  } catch { return ""; }
}

function pathMatches(sourceUrl,prospectUrl) {
  const sourcePath=normalizedPath(sourceUrl);
  const prospectPath=normalizedPath(prospectUrl);
  return Boolean(sourcePath&&prospectPath&&(sourcePath===prospectPath||sourcePath.startsWith(`${prospectPath}/`)));
}

function whatsappPhoneFromSource(sourceUrl) {
  try {
    const url=new URL(text(sourceUrl));
    const host=url.hostname.toLowerCase().replace(/^www\./,"");
    if(host==="wa.me") {
      const segment=url.pathname.split("/").filter(Boolean)[0]||"";
      return /^\d{7,}$/.test(segment)?segment:"";
    }
    if(host==="api.whatsapp.com") return (url.searchParams.get("phone")||"").replace(/\D/g,"");
    return "";
  } catch { return ""; }
}

function sourceBoundToProspect(sourceUrl,prospect={},declared={}) {
  const sourceHost=normalizedHost(sourceUrl);
  const prospectHost=normalizedHost(prospect.web);
  if(WHATSAPP_HOSTS.has(sourceHost)) {
    if(!declared.whatsapp) return false;
    const sourcePhone=whatsappPhoneFromSource(sourceUrl);
    return Boolean(sourcePhone&&normalizedPhones(prospect.whatsapp).includes(sourcePhone));
  }
  if(hostMatches(sourceHost,prospectHost)) {
    if(SOCIAL_HOSTS.has(sourceHost)||SOCIAL_HOSTS.has(prospectHost)) return pathMatches(sourceUrl,prospect.web);
    return true;
  }
  return false;
}

function normalizedEmails(value) {
  return [...new Set((text(value).match(EMAIL_PATTERN)||[]).map(item=>item.toLowerCase()))];
}

function normalizedPhones(value) {
  return [...new Set((text(value).match(PHONE_PATTERN)||[]).map(item=>item.replace(/\D/g,"")).filter(item=>item.length>=7))];
}

function channelsForType(value) {
  const type=text(value).toUpperCase();
  return {
    email:type.includes("OFFICIAL_EMAIL"),
    whatsapp:type.includes("OFFICIAL_WHATSAPP")||type.includes("EMAIL_AND_WHATSAPP")
  };
}

export function evaluateContactEvidence(input={},prospect={}) {
  const decision=text(input.decision).toUpperCase();
  const prospectKey=text(input.prospectKey??input.prospect_key);
  const sourceUrl=text(input.sourceUrl??input.source_url);
  const evidenceType=text(input.evidenceType??input.evidence_type).toUpperCase();
  const detail=text(input.detail);
  const timestamp=text(input.timestamp);
  const declared=channelsForType(evidenceType);
  const failures=[];
  if(!PROSPECT_KEY.test(prospectKey)) failures.push("CANONICAL_PROSPECT_KEY_REQUIRED");
  if(!ACCEPTED_DECISIONS.has(decision)) failures.push("ACCEPTED_DECISION_REQUIRED");
  if(!validOfficialSource(sourceUrl)) failures.push("OFFICIAL_HTTPS_SOURCE_REQUIRED");
  else if(!sourceBoundToProspect(sourceUrl,prospect,declared)) failures.push("SOURCE_NOT_BOUND_TO_PROSPECT");
  if(!validTimestamp(timestamp)) failures.push("TIMESTAMP_INVALID");
  if(!detail) failures.push("CONTACT_DETAIL_REQUIRED");
  if(!declared.email&&!declared.whatsapp) failures.push("OFFICIAL_CONTACT_TYPE_REQUIRED");

  const evidenceEmails=normalizedEmails(detail);
  const evidencePhones=normalizedPhones(detail);
  const prospectEmails=normalizedEmails(prospect.email);
  const prospectPhones=normalizedPhones(prospect.whatsapp);
  const baseValid=failures.length===0;
  const emailVerified=baseValid&&declared.email&&prospectEmails.some(value=>evidenceEmails.includes(value));
  const whatsappVerified=baseValid&&declared.whatsapp&&prospectPhones.some(value=>evidencePhones.includes(value));
  if(baseValid&&declared.email&&!emailVerified) failures.push("EMAIL_VALUE_NOT_EVIDENCED");
  if(baseValid&&declared.whatsapp&&!whatsappVerified) failures.push("WHATSAPP_VALUE_NOT_EVIDENCED");

  return {
    prospectKey,
    decision,
    evidenceType,
    sourceUrl,
    timestamp,
    emailVerified,
    whatsappVerified,
    anyVerified:emailVerified||whatsappVerified,
    failures:[...new Set(failures)]
  };
}

export function summarizeContactEvidence(records=[],prospect={}) {
  const evaluated=records.map(row=>({
    evidenceId:text(row.evidenceId??row.evidence_id),
    ...evaluateContactEvidence(row,prospect)
  })).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
  const email=evaluated.find(row=>row.emailVerified);
  const whatsapp=evaluated.find(row=>row.whatsappVerified);
  return {
    emailVerified:Boolean(email),
    whatsappVerified:Boolean(whatsapp),
    anyVerified:Boolean(email||whatsapp),
    emailEvidenceId:email?.evidenceId||"",
    whatsappEvidenceId:whatsapp?.evidenceId||"",
    emailSourceUrl:email?.sourceUrl||"",
    whatsappSourceUrl:whatsapp?.sourceUrl||"",
    evaluatedCount:evaluated.length,
    failures:[...new Set(evaluated.flatMap(row=>row.failures))]
  };
}

