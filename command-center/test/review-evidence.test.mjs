import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  canonicalReviewEvidencePreimage,
  reviewEvidenceHash,
  evaluateReviewEvidence,
  assertReviewEvidence,
  reviewEvidenceRecord
} from "../review-evidence.mjs";
import { appendReviewEvidence, buildLiveSnapshot } from "../sheets-live.mjs";

const fixture=Object.freeze({
  evidenceId:"TEST-REVIEW-1",prospectKey:"WIS-P-TEST-1",rowNumber:2,empresa:"Test hotel",
  mapsUrl:"https://www.google.com/maps/place/Test/@1,2,17z",
  exactListingVerified:true,opinionsOpened:true,sortedLowest:true,
  lowReviewCount:12,analyzedCount:12,checkedAt:"2020-01-02T03:04:05.000Z",
  reviewer:"test-reviewer",status:"VERIFIED"
});
const preimage=JSON.stringify([
  "wis.review-evidence.v1",fixture.prospectKey,fixture.mapsUrl,true,true,true,
  12,12,fixture.checkedAt,fixture.reviewer
]);
const expectedHash=createHash("sha256").update(preimage,"utf8").digest("hex");
const valid=(overrides={})=>({...fixture,evidenceHash:expectedHash,...overrides});
const headers=["evidence_id","prospect_key","source_row","empresa","maps_url",
  "exact_listing_verified","opinions_opened","sorted_lowest","low_review_count",
  "analyzed_count","checked_at","reviewer","evidence_hash","status","blocker"];
const toSheet=r=>[r.evidenceId,r.prospectKey,r.rowNumber,r.empresa,r.mapsUrl,
  r.exactListingVerified?"TRUE":"FALSE",r.opinionsOpened?"TRUE":"FALSE",
  r.sortedLowest?"TRUE":"FALSE",String(r.lowReviewCount),String(r.analyzedCount),
  r.checkedAt,r.reviewer,r.evidenceHash,r.status,r.blocker||""];

test("canonical UTF-8 preimage matches the versioned contract",()=>{
  assert.equal(canonicalReviewEvidencePreimage(fixture),preimage);
  assert.equal(reviewEvidenceHash(fixture),expectedHash);
  const unicode={...fixture,reviewer:"revisor-ñ"};
  assert.equal(reviewEvidenceHash(unicode),createHash("sha256").update(
    JSON.stringify(["wis.review-evidence.v1",fixture.prospectKey,fixture.mapsUrl,
      true,true,true,12,12,fixture.checkedAt,"revisor-ñ"]),"utf8").digest("hex"));
});

test("Sheets snake_case strings and API camelCase produce the same hash",()=>{
  const snake=Object.fromEntries(headers.map((h,i)=>[h,toSheet(valid())[i]]));
  assert.equal(reviewEvidenceHash(snake),expectedHash);
  assert.equal(evaluateReviewEvidence(snake).verified,true);
  assert.equal(evaluateReviewEvidence(valid()).hashVerified,true);
});

test("SHA-256 values with valid shape but wrong content fail closed",()=>{
  for(const hash of ["0".repeat(64),"abcdef01".repeat(8)]) {
    const result=evaluateReviewEvidence(valid({evidenceHash:hash}));
    assert.equal(result.verified,false);
    assert.equal(result.directReviewAudit,false);
    assert.equal(result.supportsProblemAnalysis,false);
    assert.ok(result.failures.includes("EVIDENCE_HASH_MISMATCH"));
  }
});

for(const [field,value] of Object.entries({
  prospectKey:"WIS-P-OTHER",mapsUrl:fixture.mapsUrl+"?changed=1",
  exactListingVerified:false,opinionsOpened:false,sortedLowest:false,
  lowReviewCount:13,analyzedCount:11,checkedAt:"2020-01-03T03:04:05.000Z",
  reviewer:"another-reviewer"
})) test(`tampering ${field} invalidates the stored hash`,()=>{
  const result=evaluateReviewEvidence(valid({[field]:value}));
  assert.equal(result.hashVerified,false);
  assert.equal(result.verified,false);
  assert.ok(result.failures.includes("EVIDENCE_HASH_MISMATCH"));
});

for(const field of ["prospectKey","reviewer","checkedAt"]) test(`missing ${field} cannot verify`,()=>{
  const result=evaluateReviewEvidence(valid({[field]:""}));
  assert.equal(result.verified,false);
  assert.ok(result.failures.includes("EVIDENCE_HASH_INPUT_INVALID"));
});

test("legacy tokens are not accepted as hashes; uppercase hex remains equivalent",()=>{
  for(const hash of ["a".repeat(43),"fnv1a-12345678","repeated_block_".repeat(4)]) {
    assert.ok(evaluateReviewEvidence(valid({evidenceHash:hash})).failures.includes("EVIDENCE_HASH_INVALID"));
  }
  assert.equal(evaluateReviewEvidence(valid({evidenceHash:expectedHash.toUpperCase()})).verified,true);
});

test("a correct digest cannot bypass traversal, timestamp, URL or count gates",()=>{
  for(const override of [
    {sortedLowest:false},{mapsUrl:"https://example.com/maps/place/Test"},
    {checkedAt:"2999-01-01T00:00:00Z"},{analyzedCount:13}
  ]) {
    const record={...fixture,...override};
    record.evidenceHash=reviewEvidenceHash(record);
    assert.equal(evaluateReviewEvidence(record).hashVerified,true);
    assert.equal(evaluateReviewEvidence(record).verified,false);
  }
});

test("PENDING never supports copy even when its hash is correct",()=>{
  const record=valid({status:"PENDING",blocker:"Integrity review required"});
  assert.equal(evaluateReviewEvidence(record).hashVerified,true);
  assert.equal(evaluateReviewEvidence(record).supportsProblemAnalysis,false);
  assert.equal(reviewEvidenceRecord(record).status,"PENDING");
});

test("zero-low-review traversal needs its own correct hash and never supports problem copy",()=>{
  const record={...fixture,status:"VERIFIED_NO_LOW_REVIEWS",lowReviewCount:0,analyzedCount:0};
  record.evidenceHash=reviewEvidenceHash(record);
  const result=evaluateReviewEvidence(record);
  assert.equal(result.zeroLowReviewsVerified,true);
  assert.equal(result.supportsProblemAnalysis,false);
  assert.equal(evaluateReviewEvidence({...record,evidenceHash:"f".repeat(64)}).zeroLowReviewsVerified,false);
});

test("terminal records throw rather than silently storing unverified evidence",()=>{
  assert.throws(()=>assertReviewEvidence(valid({evidenceHash:"f".repeat(64)})),/EVIDENCE_HASH_MISMATCH/);
  assert.throws(()=>reviewEvidenceRecord(valid({reviewer:""})),/EVIDENCE_HASH_INPUT_INVALID/);
});

test("invalid terminal input is rejected before any Sheets call or formatting mutation",async t=>{
  const calls=[];
  t.mock.method(globalThis,"fetch",async(...args)=>{calls.push(args);throw new Error("Network prohibited");});
  await assert.rejects(appendReviewEvidence(valid({evidenceHash:"f".repeat(64)})),/EVIDENCE_HASH_MISMATCH/);
  await assert.rejects(appendReviewEvidence(valid({empresa:""})),/REVIEW_EVIDENCE_IDENTITY_REQUIRED/);
  assert.equal(calls.length,0);
});

for(const scenario of [
  {name:"tampered latest",checkedAt:"2020-02-02T03:04:05.000Z",status:"VERIFIED"},
  {name:"chronologically later offset",checkedAt:"2020-01-02T01:04:05.000-03:00",status:"PENDING"},
  {name:"same timestamp later append",checkedAt:fixture.checkedAt,status:"PENDING"},
  {name:"unparseable later append",checkedAt:"unknown",status:"PENDING"},
  {name:"unparseable earlier append",checkedAt:"unknown",status:"PENDING",invalidFirst:true}
]) test(`live snapshot blocks ${scenario.name} instead of falling back to older VERIFIED`,async t=>{
  const envKeys=["GOOGLE_SERVICE_ACCOUNT_EMAIL","GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64","WIS_SHEETS_WRITES_ENABLED"];
  const old=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of envKeys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];});
  const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}});
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL="test@example.invalid";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=privateKey;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;
  process.env.WIS_SHEETS_WRITES_ENABLED="false";
  const record2={...fixture,evidenceId:"TEST-2",prospectKey:"WIS-P-TEST-2",rowNumber:3};
  record2.evidenceHash=reviewEvidenceHash(record2);
  const newer=valid({evidenceId:"TEST-NEWER",checkedAt:scenario.checkedAt,status:scenario.status});
  const sheetRecords=scenario.invalidFirst?[newer,valid(),record2]:[valid(),newer,record2];
  const commercialHeaders=["Rubro","Empresa","Ubicación","WhatsApp","Web","Email","Rating",
    "Reseñas analizadas","Problemas","ANALISIS NEGOCIO","Mensaje WhatsApp","Mensaje Email","ID Prospecto"];
  const calls=[];
  t.mock.method(globalThis,"fetch",async(url,options={})=>{
    const target=new URL(url);
    calls.push({url:target.pathname,method:options.method||"GET"});
    if(target.href==="https://oauth2.googleapis.com/token") return Response.json({access_token:"test-only",expires_in:3600});
    assert.equal(options.method||"GET","GET","no Sheets mutations during snapshot");
    assert.ok(target.pathname.endsWith("/values:batchGet"),"unexpected network route");
    return Response.json({valueRanges:target.searchParams.getAll("ranges").map(range=>({
      range,values:range.startsWith("PROSPECTOS!")?[commercialHeaders,
        ["Hoteles","Test hotel","","","","test@example.invalid","","12/12","Problem","Analysis","","Draft",fixture.prospectKey],
        ["Hoteles","Test hotel2","","","","test2@example.invalid","","12/12","Problem","Analysis","","Draft",record2.prospectKey]]:
        range.startsWith("Review_Evidence!")?[headers,...sheetRecords.map(toSheet)]:[]
    }))});
  });
  const snapshot=await buildLiveSnapshot();
  assert.equal(snapshot.prospects[0].reviewVerification.evidenceId,"TEST-NEWER");
  assert.equal(snapshot.prospects[0].reviewVerification.verified,false);
  assert.equal(snapshot.prospects[0].reviewVerification.hashVerified,scenario.checkedAt===fixture.checkedAt);
  assert.equal(snapshot.prospects[0].reviewVerification.supportsProblemAnalysis,false);
  assert.equal(snapshot.prospects[1].reviewVerification.verified,true);
  assert.equal(snapshot.prospects[1].reviewVerification.hashVerified,true);
  assert.ok(calls.length>1);
});

test("production image copies the runtime module used by the verification tests",()=>{
  const dockerfile=readFileSync(new URL("../Dockerfile",import.meta.url),"utf8");
  assert.match(dockerfile,/COPY[^\n]*review-evidence\.mjs/);
});
