import assert from "node:assert/strict";
import test from "node:test";
import {
  CORRALONES_CAMPAIGN,
  MADERERAS_CAMPAIGN,
  evaluateSupplierCandidate,
  supplierCampaignProfile,
  supplierSheetRow
} from "./supplier-research.mjs";
import { extractPublishedContactSet } from "./supplier-research-worker.mjs";

test("supplier campaigns stay fixed to 1,000 LATAM contacts",()=>{
  assert.equal(supplierCampaignProfile({businessType:"corralones"}).campaignId,"corralones-latam-1000");
  assert.equal(supplierCampaignProfile({destination:"Madereras_LATAM_1000"}).campaignId,"madereras-latam-1000");
  assert.equal(CORRALONES_CAMPAIGN.target,1000);
  assert.equal(MADERERAS_CAMPAIGN.requireBothContacts,true);
});

test("candidate requires an official site, published email and explicit WhatsApp",()=>{
  const complete={displayName:"Corralón Central",formattedAddress:"Córdoba, Argentina",websiteUri:"https://corraloncentral.example",category:"hardware building materials",emails:["ventas@corraloncentral.example"],whatsapps:["+5493515551234"]};
  assert.equal(evaluateSupplierCandidate(complete,CORRALONES_CAMPAIGN).eligible,true);
  assert.equal(evaluateSupplierCandidate({...complete,whatsapps:[]},CORRALONES_CAMPAIGN).reasons.includes("EMAIL_AND_WHATSAPP_REQUIRED"),true);
  assert.equal(evaluateSupplierCandidate({...complete,emails:[]},CORRALONES_CAMPAIGN).reasons.includes("EMAIL_AND_WHATSAPP_REQUIRED"),true);
});

test("large chains are excluded",()=>{
  const candidate={displayName:"Home Depot Centro",formattedAddress:"México",websiteUri:"https://homedepot.example",category:"building materials",emails:["ventas@homedepot.example"],whatsapps:["+525555551234"]};
  assert.equal(evaluateSupplierCandidate(candidate,CORRALONES_CAMPAIGN).reasons.includes("LARGE_CHAIN_EXCLUDED"),true);
});

test("sheet row preserves multiple contacts and leaves analysis columns blank",()=>{
  const candidate={displayName:"Maderas del Sur",formattedAddress:"Temuco, Chile",websiteUri:"https://maderasdelsur.example",category:"maderera timber",emails:["ventas@maderasdelsur.example","pedidos@maderasdelsur.example"],whatsapps:["+56911112222","+56933334444"]};
  const row=supplierSheetRow(candidate,MADERERAS_CAMPAIGN);
  assert.equal(row.length,12);
  assert.equal(row[3],"+56911112222\n+56933334444");
  assert.equal(row[5],"ventas@maderasdelsur.example\npedidos@maderasdelsur.example");
  assert.deepEqual(row.slice(7),["","","","",""]);
});

test("website extraction accepts only explicit WhatsApp links",()=>{
  const html=`<a href="mailto:ventas@maderas.example">Email</a>
    <a href="https://wa.me/5491112345678">WhatsApp</a>
    <p>Teléfono +54 11 9999 9999</p>
    <p>support@third-party.invalid</p>`;
  const contacts=extractPublishedContactSet(html,"https://maderas.example/contacto");
  assert.deepEqual(contacts.emails,["ventas@maderas.example"]);
  assert.deepEqual(contacts.whatsapps,["+5491112345678"]);
});
