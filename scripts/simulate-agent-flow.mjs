import fs from "node:fs/promises";

const task = JSON.parse(await fs.readFile(new URL("../agents/examples/task.revenue-research.json", import.meta.url), "utf8"));
const transitions = new Map([
  ["BACKLOG", ["READY", "CANCELLED"]],
  ["READY", ["IN_PROGRESS", "BLOCKED", "CANCELLED"]],
  ["IN_PROGRESS", ["REVIEW", "BLOCKED", "CANCELLED"]],
  ["REVIEW", ["IN_PROGRESS", "WAITING_APPROVAL", "DONE", "BLOCKED"]],
  ["WAITING_APPROVAL", ["DONE", "IN_PROGRESS", "CANCELLED"]],
]);

function move(current, next) {
  if (!(transitions.get(current) ?? []).includes(next)) {
    throw new Error(`Transición inválida: ${current} -> ${next}`);
  }
  return next;
}

let status = task.status;
for (const next of ["READY", "IN_PROGRESS", "REVIEW"]) status = move(status, next);

const externalAction = "send_email";
if (externalAction === "send_email") status = move(status, "WAITING_APPROVAL");
if (status !== "WAITING_APPROVAL") throw new Error("El efecto externo no quedó bloqueado para aprobación");

console.log(`Dry-run valid: ${task.task_id} reached ${status} without external side effects.`);

