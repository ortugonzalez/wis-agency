import test from "node:test";
import assert from "node:assert/strict";
import { normalizePipelineConfig, pipelineAutomationState } from "../../ops/reports/web/wis-operations-dashboard/server.mjs";

function command(action,createdAt,evidence={},status="NEW",commandId=action) {
  return {command_id:commandId,created_at:createdAt,action,status,idempotency_key:`${commandId}:key`,evidence:JSON.stringify(evidence)};
}

test("la configuración automática queda dentro de límites seguros",()=>{
  const config=normalizePipelineConfig({intervalMinutes:1,batchSize:200,maxSpecialists:9,dryRun:false});
  assert.equal(config.intervalMinutes,10);
  assert.equal(config.batchSize,25);
  assert.equal(config.maxSpecialists,3);
  assert.equal(config.emailMode,"APPROVAL_REQUIRED");
  assert.equal(config.whatsappMode,"OPTIN_AND_APPROVAL_REQUIRED");
});

test("actualizar configuración no apaga un pipeline activo",()=>{
  const rows=[
    command("PIPELINE_ACTIVATE","2026-10-05T12:00:00.000Z",{config:{batchSize:25}}),
    command("PIPELINE_UPDATE_CONFIG","2026-10-05T12:05:00.000Z",{config:{batchSize:10}})
  ];
  const state=pipelineAutomationState(rows,[],[],{});
  assert.equal(state.status,"ACTIVE");
  assert.equal(state.config.batchSize,10);
  assert.equal(state.latestControl.action,"PIPELINE_UPDATE_CONFIG");
  assert.equal(state.latestLifecycle.action,"PIPELINE_ACTIVATE");
});

test("un run de research reciente no finge un heartbeat conectado",()=>{
  const state=pipelineAutomationState(
    [command("PIPELINE_ACTIVATE",new Date().toISOString())],
    [],
    [{agent:"prospect-research",status:"IN_PROGRESS",updated_at:new Date().toISOString()}],
    {}
  );
  assert.equal(state.executor.connected,false);
  assert.equal(state.lanes.find(row=>row.id==="orchestrator").status,"WAITING_HEARTBEAT");
});

test("reduce actualizaciones append-only por idempotency key",()=>{
  const first=command("PIPELINE_PAUSE","2026-10-05T12:00:00.000Z",{},"NEW","CMD-1");
  const done={...first,status:"DONE",updated_at:"2026-10-05T12:01:00.000Z"};
  const state=pipelineAutomationState([first,done],[],[],{});
  const same=state.recentCommands.filter(row=>row.commandId==="CMD-1");
  assert.equal(same.length,1);
  assert.equal(same[0].status,"DONE");
});

test("sólo un heartbeat explícito marca el ejecutor conectado",()=>{
  const now=new Date().toISOString();
  const state=pipelineAutomationState([
    command("PIPELINE_ACTIVATE",now),
    command("PIPELINE_HEARTBEAT",now,{leaseOwner:"wis-orchestrator"},"DONE","HB-1")
  ],[],[],{});
  assert.equal(state.executor.connected,true);
  assert.equal(state.lanes.find(row=>row.id==="orchestrator").status,"WORKING");
});
