#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  appendCommandSnapshot,
  JsonPipelineStore,
  PipelinePlanner,
  summarizePipeline
} from "./pipeline-dispatcher.mjs";

function parse(argv) {
  const options = { command: argv[0] ?? "plan", state: ".wis-runtime/pipeline-state.json" };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--state") options.state = argv[++index];
    else if (arg === "--input") options.input = argv[++index];
    else if (arg === "--owner") options.owner = argv[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

async function readArray(file, property) {
  if (!file) throw new Error("--input is required");
  const parsed = JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
  const value = Array.isArray(parsed) ? parsed : parsed[property];
  if (!Array.isArray(value)) throw new Error(`Input must be an array or { ${property}: [] }`);
  return value;
}

async function main() {
  const options = parse(process.argv.slice(2));
  const store = new JsonPipelineStore(path.resolve(options.state));
  const planner = new PipelinePlanner({ store, owner: options.owner ?? "heartbeat-dispatcher" });
  if (options.command === "sync") {
    await appendCommandSnapshot(store, await readArray(options.input, "commands"));
    console.log(JSON.stringify(summarizePipeline(await store.read()), null, 2));
  } else if (options.command === "plan") {
    console.log(JSON.stringify(await planner.plan(), null, 2));
  } else if (options.command === "complete") {
    await planner.complete(await readArray(options.input, "results"));
    console.log(JSON.stringify(summarizePipeline(await store.read()), null, 2));
  } else if (options.command === "recover") {
    await planner.recover();
    console.log(JSON.stringify(summarizePipeline(await store.read()), null, 2));
  } else if (options.command === "status") {
    console.log(JSON.stringify(summarizePipeline(await store.read()), null, 2));
  } else if (options.command === "outreach-plan") {
    const contexts = options.input ? JSON.parse(await fs.readFile(path.resolve(options.input), "utf8")) : {};
    console.log(JSON.stringify(await planner.planApprovedOutreach({ contexts }), null, 2));
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }
}

main().catch(error => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
