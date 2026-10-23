import { createHash } from "node:crypto";

const REVIEW_EVIDENCE_SCHEMA="wis.review-evidence.v1";
const GOOGLE_MAPS_HOSTS=new Set(["google.com","www.google.com","maps.google.com","maps.app.goo.gl"]);
const TERMINAL_STATUSES=new Set(["VERIFIED","VERIFIED_NO_LOW_REVIEWS"]);

function requiredString(value,field) {
  const normalized=String(value??"").trim();
  if(!normalized) throw new TypeError(`${field} is required`);
  return normalized;
}

function requiredBoolean(value,field) {
  if(value===true||value==="TRUE") return true;
  if(value===false||value==="FALSE") return false;
  throw new TypeError(`${field} must be boolean`);
}

function requiredCount(value,field) {
  const normalized=Number(value);
  if(!Number.isInteger(normalized)||normalized<0) throw new TypeError(`${field} must be a non-negative integer`);
  return normalized;
}

export function canonicalReviewEvidencePreimage(input={}) {
  return JSON.stringify([
    REVIEW_EVIDENCE_SCHEMA,
    requiredString(input.prospectKey??input.prospect_key,"prospect_key"),
    requiredString(input.mapsUrl??input.maps_url,"maps_url"),
    requiredBoolean(input.exactListingVerified??input.exact_listing_verified,"exact_listing_verified"),
    requiredBoolean(input.opinionsOpened??input.opinions_opened,"opinions_opened"),
    requiredBoolean(input.sortedLowest??input.sorted_lowest,"sorted_lowest"),
    requiredCount(input.lowReviewCount??input.low_review_count,"low_review_count"),
    requiredCount(input.analyzedCount??input.analyzed_count,"analyzed_count"),
    requiredString(input.checkedAt??input.checked_at,"checked_at"),
    requiredString(input.reviewer,"reviewer")
  ]);
}

export function reviewEvidenceHash(input) {
  return createHash("sha256").update(canonicalReviewEvidencePreimage(input),"utf8").digest("hex");
}

function bool(value) {
  return value===true||["TRUE","SI","SÍ","YES","1"].includes(String(value||"").trim().toUpperCase());
}

function integer(value) {
  if(value===""||value===null||value===undefined) return null;
  const parsed=Number(value);
  return Number.isInteger(parsed)&&parsed>=0?parsed:null;
}

function validMapsUrl(value) {
  try {
    const url=new URL(String(value||"").trim());
    const host=url.hostname.toLowerCase();
    return url.protocol==="https:"&&(GOOGLE_MAPS_HOSTS.has(host)||host.endsWith(".google.com"))&&
      url.pathname.startsWith("/maps/place/");
  } catch { return false; }
}

function validTimestamp(value) {
  const timestamp=Date.parse(String(value||""));
  return Number.isFinite(timestamp)&&timestamp<=Date.now()+5*60_000;
}

function validEvidenceHash(value) {
  return /^[a-f0-9]{64}$/i.test(String(value||"").trim());
}

export function evaluateReviewEvidence(input={}) {
  const status=String(input.status||"PENDING").trim().toUpperCase();
  const lowReviewCount=integer(input.lowReviewCount??input.low_review_count);
  const analyzedCount=integer(input.analyzedCount??input.analyzed_count);
  const directSteps={
    exactListingVerified:bool(input.exactListingVerified??input.exact_listing_verified),
    opinionsOpened:bool(input.opinionsOpened??input.opinions_opened),
    sortedLowest:bool(input.sortedLowest??input.sorted_lowest)
  };
  const failures=[];
  if(!validMapsUrl(input.mapsUrl??input.maps_url)) failures.push("GOOGLE_MAPS_URL_REQUIRED");
  if(!directSteps.exactListingVerified) failures.push("EXACT_LISTING_NOT_VERIFIED");
  if(!directSteps.opinionsOpened) failures.push("OPINIONS_NOT_OPENED");
  if(!directSteps.sortedLowest) failures.push("LOWEST_SORT_NOT_VERIFIED");
  if(lowReviewCount===null||analyzedCount===null||analyzedCount>lowReviewCount) failures.push("REVIEW_COUNTS_INVALID");
  if(!validTimestamp(input.checkedAt??input.checked_at)) failures.push("CHECKED_AT_INVALID");
  const storedHash=String(input.evidenceHash??input.evidence_hash??"").trim();
  if(!validEvidenceHash(storedHash)) failures.push("EVIDENCE_HASH_INVALID");
  let hashVerified=false;
  try {
    const expectedHash=reviewEvidenceHash(input);
    hashVerified=validEvidenceHash(storedHash)&&storedHash.toLowerCase()===expectedHash;
    if(validEvidenceHash(storedHash)&&!hashVerified) failures.push("EVIDENCE_HASH_MISMATCH");
  } catch {
    failures.push("EVIDENCE_HASH_INPUT_INVALID");
  }

  const directReviewAudit=failures.length===0;
  const zeroLowReviewsVerified=directReviewAudit&&status==="VERIFIED_NO_LOW_REVIEWS"&&lowReviewCount===0&&analyzedCount===0;
  const verified=directReviewAudit&&status==="VERIFIED"&&analyzedCount>0&&lowReviewCount>=analyzedCount;
  const statusMismatch=TERMINAL_STATUSES.has(status)&&!verified&&!zeroLowReviewsVerified;
  if(statusMismatch) failures.push("VERIFIED_STATUS_CONTRADICTS_EVIDENCE");

  return {
    status,
    hashSchema:REVIEW_EVIDENCE_SCHEMA,
    hashVerified,
    ...directSteps,
    lowReviewCount,
    analyzedCount,
    directReviewAudit,
    verified,
    zeroLowReviewsVerified,
    supportsProblemAnalysis:verified,
    failures:[...new Set(failures)]
  };
}

export function assertReviewEvidence(input,{allowPending=true}={}) {
  const result=evaluateReviewEvidence(input);
  if(result.verified||result.zeroLowReviewsVerified) return result;
  if(allowPending&&!TERMINAL_STATUSES.has(result.status)) return result;
  throw new Error(`REVIEW_EVIDENCE_INVALID_${result.failures.join("_")||"UNKNOWN"}`);
}

export function reviewEvidenceRecord(input) {
  const evaluation=assertReviewEvidence(input);
  return {
    evidenceId:String(input.evidenceId??input.evidence_id??"").trim(),
    prospectKey:String(input.prospectKey??input.prospect_key??"").trim(),
    rowNumber:integer(input.rowNumber??input.source_row),
    empresa:String(input.empresa||"").trim(),
    mapsUrl:String(input.mapsUrl??input.maps_url??"").trim(),
    exactListingVerified:evaluation.exactListingVerified,
    opinionsOpened:evaluation.opinionsOpened,
    sortedLowest:evaluation.sortedLowest,
    lowReviewCount:evaluation.lowReviewCount,
    analyzedCount:evaluation.analyzedCount,
    checkedAt:String(input.checkedAt??input.checked_at??"").trim(),
    reviewer:String(input.reviewer||"").trim(),
    evidenceHash:String(input.evidenceHash??input.evidence_hash??"").trim(),
    status:evaluation.status,
    blocker:String(input.blocker||"").trim(),
    evaluation
  };
}
