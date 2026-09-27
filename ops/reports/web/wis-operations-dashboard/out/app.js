const data = {
  snapshot: "2026-09-27",
  tasks: [
    { id: "WIS-SYS-001", stream: "Foundation", title: "Implementar la base multiagente", priority: "P0", owner: "wis-orchestrator", status: "DONE", dependency: "—", deliverable: "Contratos, baseline, tablero y dry-run", scope: "Repositorio raíz y tablero operativo", approval: "NO", next: "Iniciar auditoría WIS-REV-001", updated: "26/09/2026 20:05" },
    { id: "WIS-REV-001", stream: "Revenue", title: "Auditar distribuidoras provisionales", priority: "P0", owner: "growth-research", status: "READY", dependency: "WIS-SYS-001", deliverable: "Primer lote validado de 25 filas", scope: "Columnas comerciales existentes", approval: "NO", next: "Auditar filas provisionales y preparar lote 1/25", updated: "26/09/2026 20:05" },
    { id: "WIS-REV-002", stream: "Revenue", title: "Completar 300 distribuidoras argentinas", priority: "P0", owner: "growth-research", status: "BACKLOG", dependency: "WIS-REV-001", deliverable: "300 empresas únicas con QA", scope: "Columnas comerciales existentes", approval: "NO", next: "Procesar lotes de 25", updated: "26/09/2026 12:00" },
    { id: "WIS-LOG-001", stream: "Revenue", title: "Completar 300 logísticas de Latinoamérica", priority: "P1", owner: "growth-research", status: "BACKLOG", dependency: "WIS-REV-002", deliverable: "300 logísticas únicas con QA", scope: "Planilla comercial autorizada", approval: "NO", next: "Comenzar después de distribuidoras", updated: "26/09/2026 12:00" },
    { id: "WIS-WEB-001", stream: "Operations", title: "Crear dashboard general operativo", priority: "P1", owner: "web-brand", status: "WAITING_APPROVAL", dependency: "WIS-SYS-001", deliverable: "Dashboard responsive e informe de uso", scope: "ops/reports/web/**", approval: "SI: despliegue", next: "Aprobar o rechazar despliegue privado owner-only", updated: "27/09/2026" }
  ],
  runs: [
    { id: "RUN-WIS-SYS-001-001", task: "WIS-SYS-001", agent: "wis-orchestrator", status: "DONE", evidence: "Commit f3136c1 · tag baseline-multiagent-v1", tests: "Sistema 3/3 · dry-run OK · WIS X 25/25", finished: "26/09/2026 20:05" },
    { id: "RUN-WIS-WEB-001-001", task: "WIS-WEB-001", agent: "web-brand", status: "WAITING_APPROVAL", evidence: "Dashboard local y documento de uso preparados", tests: "JavaScript OK · tests 3/3 · desktop y móvil OK · consola sin errores", finished: "—" }
  ],
  approvals: [
    { id: "APR-WIS-WEB-001-001", task: "WIS-WEB-001", action: "Desplegar dashboard como Site privado owner-only", impact: "Crea una URL privada sin publicar datos al público", status: "PENDING" }
  ],
  handoffs: [
    { id: "HOF-WIS-SYS-001-001", task: "WIS-SYS-001", from: "qa-ops", to: "wis-orchestrator", status: "DONE", artifact: "docs/BASELINE_INVENTORY.md", evidence: "Repositorios anidados y artefactos generados identificados", next: "Iniciar WIS-REV-001 desde la planilla comercial" }
  ],
  agents: [
    { id: "wis-orchestrator", name: "Orquestador", kind: "orchestrator", color: "cyan", mission: "Convertir objetivos en tareas no superpuestas, asignar responsables, controlar dependencias, aprobaciones e integración.", scope: ["AGENTS.md y contratos", "ops/orchestration/**", "tablero operativo"], limits: ["no ejecutar trabajo especialista", "no aprobar acciones propias", "no omitir QA"], tags: ["cola", "dependencias", "integración"] },
    { id: "growth-research", name: "Research", kind: "specialist", color: "violet", mission: "Descubrir, enriquecer y validar prospectos, contactos corporativos y reseñas con evidencia verificable.", scope: ["ops/reports/research/**", "planillas comerciales autorizadas", "fuentes públicas y Maps"], limits: ["no adivinar contactos", "sólo reseñas 1–3 estrellas", "no enviar outreach"], tags: ["prospectos", "Maps", "Sheets"] },
    { id: "commercial-activation", name: "Activación comercial", kind: "specialist", color: "violet", mission: "Preparar mensajes, follow-ups, calificación y propuestas personalizadas usando sólo prospectos validados.", scope: ["ops/reports/commercial/**", "columnas comerciales existentes", "propuestas autorizadas"], limits: ["no enviar WhatsApp o email", "no publicar", "no inventar evidencia"], tags: ["WhatsApp", "email", "propuestas"] },
    { id: "content-strategy", name: "Contenido", kind: "specialist", color: "violet", mission: "Crear briefs, calendario editorial, casos y voz de marca reutilizable basados en evidencia.", scope: ["ops/reports/content/**", "estrategia editorial", "borradores autorizados"], limits: ["no publicar", "no fabricar casos", "no cambiar runtimes"], tags: ["briefs", "calendario", "casos"] },
    { id: "linkedin-operator", name: "LinkedIn", kind: "specialist", color: "violet", mission: "Mantener el carril LinkedIn, sus borradores, aprobaciones, idempotencia y publicación controlada.", scope: ["scripts LinkedIn asignados", "ops/reports/linkedin/**", "sistemas en modo lectura"], limits: ["no habilitar publicación", "no reintentar a ciegas", "no publicar sin aprobación"], tags: ["dry-run", "n8n", "aprobación"] },
    { id: "x-operator", name: "X", kind: "specialist", color: "violet", mission: "Mantener el carril aislado de X con OAuth, publicación idempotente, reconciliación y dry-run seguro.", scope: ["wis_x/**", "ops/reports/x/**", "X API en lectura"], limits: ["no desactivar dry-run", "no habilitar el sistema", "no tocar estado LinkedIn"], tags: ["X API", "dry-run", "reconciliación"] },
    { id: "web-brand", name: "Web y marca", kind: "specialist", color: "violet", mission: "Mantener la web y los activos de marca usando únicamente contenido y casos aprobados.", scope: ["frontend WIS autorizado", "ops/reports/web/**", "preview de navegador"], limits: ["no desplegar sin aprobación", "no inventar casos", "no modificar otros repositorios"], tags: ["web", "marca", "responsive"] },
    { id: "automation-integrations", name: "Automatizaciones", kind: "specialist", color: "violet", mission: "Mantener integraciones compartidas, n8n, esquemas, seguridad y observabilidad sin apropiarse de la lógica de canal.", scope: ["automation/** e infra/**", "backend WIS autorizado", "n8n y Supabase en lectura"], limits: ["no activar workflows", "no guardar secretos", "no migrar producción sin aprobación"], tags: ["n8n", "Supabase", "infra"] },
    { id: "qa-ops", name: "QA Ops", kind: "qa", color: "amber", mission: "Realizar QA independiente, seguridad, regresión, incidentes, observabilidad y validación de aceptación.", scope: ["lectura global", "ops/reports/qa/**", "test/qa/**"], limits: ["no aprobar trabajo propio", "no parchear en silencio", "no ejecutar efectos externos"], tags: ["QA", "seguridad", "runbooks"] }
  ],
  conversations: [
    { title: "BUSQUEDA PROSPECTOS WIS", agents: ["growth-research", "commercial-activation", "qa-ops"] },
    { title: "Crear propuesta para Doña Fransica", agents: ["commercial-activation"] },
    { title: "Analiza sheet y plan de mails", agents: ["commercial-activation"] },
    { title: "BOT PROSPECCION WIS WSP", agents: ["commercial-activation", "automation-integrations", "qa-ops"] },
    { title: "BOT LINKEDIN WIS", agents: ["linkedin-operator", "automation-integrations", "qa-ops"] },
    { title: "Actualizar web de WIS Agency", agents: ["web-brand", "content-strategy"] },
    { title: "Construir WIS X Bot", agents: ["x-operator", "qa-ops"] },
    { title: "Diseñar bot beta tester", agents: ["qa-ops"] },
    { title: "Arma calendario de contenidos WIS", agents: ["content-strategy"] },
    { title: "Investiga bots de WhatsApp en GitHub", agents: ["commercial-activation", "automation-integrations", "qa-ops"] },
    { title: "Diseñar agente prospección B2B", agents: ["growth-research", "commercial-activation"] },
    { title: "ORQUESTADOR BOT WIS", agents: ["wis-orchestrator", "qa-ops"] }
  ]
};

const titles = { overview: "Visión general", work: "Trabajo operativo", agents: "Mapa de agentes", sources: "Conversaciones fuente" };

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const statusClass = status => ({ DONE: "pill-done", READY: "pill-ready", IN_PROGRESS: "pill-progress", REVIEW: "pill-review", BACKLOG: "pill-backlog", WAITING_APPROVAL: "pill-waiting", BLOCKED: "pill-blocked", CANCELLED: "pill-cancelled", PENDING: "pill-waiting" })[status] || "pill-backlog";
const statusLabel = status => status.replaceAll("_", " ");

function renderMetrics() {
  const done = data.tasks.filter(task => task.status === "DONE").length;
  const active = data.tasks.filter(task => ["READY", "IN_PROGRESS", "REVIEW"].includes(task.status)).length;
  const metrics = [
    { label: "Tareas totales", value: data.tasks.length, foot: `${done} completada · ${active} lista`, color: "#6ee7d2" },
    { label: "Aprobaciones", value: data.approvals.length, foot: data.approvals.length ? "Acción externa pendiente" : "Sin acciones externas pendientes", color: "#f2c56b" },
    { label: "Agentes definidos", value: data.agents.length, foot: "Máximo 3 especialistas a la vez", color: "#b3a1ff" },
    { label: "Fuentes conectadas", value: data.conversations.length, foot: "Conversaciones preservadas", color: "#79aefc" }
  ];
  document.querySelector("#metric-grid").innerHTML = metrics.map(metric => `
    <article class="metric-card" style="--metric-color:${metric.color}">
      <div class="metric-top"><span>${escapeHtml(metric.label)}</span><i class="metric-indicator"></i></div>
      <strong class="metric-value">${metric.value}</strong><span class="metric-foot">${escapeHtml(metric.foot)}</span>
    </article>`).join("");
}

function renderCriticalPath() {
  const criticalIds = ["WIS-SYS-001", "WIS-REV-001", "WIS-REV-002", "WIS-LOG-001"];
  document.querySelector("#critical-path").innerHTML = data.tasks.filter(task => criticalIds.includes(task.id)).map((task, index) => `
    <article class="path-step ${task.status === "READY" ? "is-current" : ""}">
      <span class="step-number">0${index + 1} · ${escapeHtml(task.id)}</span>
      <h3>${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.deliverable)}</p>
      <span class="pill ${statusClass(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
    </article>`).join("");
}

function renderTasks() {
  const query = document.querySelector("#task-search").value.trim().toLowerCase();
  const status = document.querySelector("#status-filter").value;
  const rows = data.tasks.filter(task => {
    const matchesQuery = [task.id, task.title, task.owner, task.next].join(" ").toLowerCase().includes(query);
    return matchesQuery && (status === "ALL" || task.status === status);
  });
  document.querySelector("#task-table-body").innerHTML = rows.length ? rows.map(task => `
    <tr tabindex="0" data-task-id="${escapeHtml(task.id)}" aria-label="Ver detalle de ${escapeHtml(task.title)}">
      <td class="task-cell"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.id)} · ${escapeHtml(task.stream)}</span></td>
      <td><span class="priority priority-${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span></td>
      <td>${escapeHtml(task.owner)}</td>
      <td><span class="pill ${statusClass(task.status)}">${escapeHtml(statusLabel(task.status))}</span></td>
      <td>${escapeHtml(task.dependency)}</td><td>${escapeHtml(task.next)}</td>
    </tr>`).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>No hay coincidencias</strong><p>Probá otro texto o quitá el filtro de estado.</p></div></td></tr>`;
  document.querySelector("#task-result-count").textContent = `${rows.length} de ${data.tasks.length} tareas`;
  document.querySelector("#work-count").textContent = data.tasks.length;
  document.querySelectorAll("[data-task-id]").forEach(row => {
    row.addEventListener("click", () => openTask(row.dataset.taskId));
    row.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); openTask(row.dataset.taskId); } });
  });
}

function renderRunsAndHandoffs() {
  document.querySelector("#runs-list").innerHTML = data.runs.map(run => `
    <article class="record-item"><div class="record-top"><span class="record-id">${escapeHtml(run.id)}</span><span class="pill ${statusClass(run.status)}">${run.status}</span></div><h3>${escapeHtml(run.agent)}</h3><p>${escapeHtml(run.evidence)}</p><p>${escapeHtml(run.tests)}</p></article>`).join("");
  document.querySelector("#handoffs-list").innerHTML = data.handoffs.map(record => `
    <article class="record-item"><div class="record-top"><span class="record-id">${escapeHtml(record.id)}</span><span class="pill ${statusClass(record.status)}">${record.status}</span></div><h3>${escapeHtml(record.from)} → ${escapeHtml(record.to)}</h3><p>${escapeHtml(record.evidence)}</p><p>Próximo: ${escapeHtml(record.next)}</p></article>`).join("");
  document.querySelector("#runs-count").textContent = data.runs.length;
}

function renderApprovals() {
  const container = document.querySelector("#approval-list");
  document.querySelector("#approval-count").textContent = data.approvals.length;
  container.innerHTML = data.approvals.length ? data.approvals.map(approval => `
    <article class="approval-item">
      <div class="record-top"><span class="record-id">${escapeHtml(approval.id)}</span><span class="pill ${statusClass(approval.status)}">${escapeHtml(approval.status)}</span></div>
      <h3>${escapeHtml(approval.action)}</h3><p>${escapeHtml(approval.impact)}</p>
    </article>`).join("") : `<div class="empty-state"><strong>Sin aprobaciones pendientes</strong><p>Las acciones externas aparecerán acá.</p></div>`;
}

function renderAgents() {
  const colors = { cyan: "#6ee7d2", violet: "#b3a1ff", amber: "#f2c56b" };
  const kinds = { orchestrator: "Orquestación", specialist: "Especialista", qa: "QA independiente" };
  document.querySelector("#agent-grid").innerHTML = data.agents.map(agent => `
    <article class="agent-card" style="--agent-color:${colors[agent.color]}">
      <div class="agent-head"><span class="agent-code">${escapeHtml(agent.id)}</span><span class="agent-kind">${kinds[agent.kind]}</span></div>
      <h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.mission)}</p>
      <div class="agent-tags">${agent.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <details class="agent-details"><summary>Ver alcance y límites</summary><div><strong>Alcance</strong><ul>${agent.scope.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul><strong>Límites</strong><ul>${agent.limits.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></details>
    </article>`).join("");
}

function renderSources() {
  const query = document.querySelector("#source-search").value.trim().toLowerCase();
  const sources = data.conversations.filter(source => [source.title, ...source.agents].join(" ").toLowerCase().includes(query));
  document.querySelector("#source-grid").innerHTML = sources.length ? sources.map(source => `
    <article class="source-card"><h3>${escapeHtml(source.title)}</h3><span class="source-id">Contexto preservado · sin copiar conversación</span><div class="source-agents">${source.agents.map(agent => `<span>${escapeHtml(agent)}</span>`).join("")}</div></article>`).join("") : `<div class="empty-state"><strong>No hay coincidencias</strong><p>Buscá por nombre o agente asignado.</p></div>`;
}

function openTask(taskId) {
  const task = data.tasks.find(item => item.id === taskId);
  if (!task) return;
  document.querySelector("#dialog-content").innerHTML = `
    <header class="dialog-header"><p class="section-kicker">${escapeHtml(task.id)} · ${escapeHtml(task.stream)}</p><h2 id="dialog-title">${escapeHtml(task.title)}</h2><div class="dialog-meta"><span class="priority priority-${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span><span class="pill ${statusClass(task.status)}">${escapeHtml(statusLabel(task.status))}</span></div></header>
    <dl class="detail-list">
      <div class="detail-row"><dt>Responsable</dt><dd>${escapeHtml(task.owner)}</dd></div>
      <div class="detail-row"><dt>Dependencia</dt><dd>${escapeHtml(task.dependency)}</dd></div>
      <div class="detail-row"><dt>Entregable</dt><dd>${escapeHtml(task.deliverable)}</dd></div>
      <div class="detail-row"><dt>Alcance de escritura</dt><dd>${escapeHtml(task.scope)}</dd></div>
      <div class="detail-row"><dt>Aprobación requerida</dt><dd>${escapeHtml(task.approval)}</dd></div>
      <div class="detail-row"><dt>Próxima acción</dt><dd>${escapeHtml(task.next)}</dd></div>
      <div class="detail-row"><dt>Actualizado</dt><dd>${escapeHtml(task.updated)}</dd></div>
    </dl>`;
  document.querySelector("#task-dialog").showModal();
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("is-active", view.dataset.view === viewName));
  document.querySelectorAll("[data-view-target]").forEach(button => button.classList.toggle("is-active", button.dataset.viewTarget === viewName));
  document.querySelector("#view-title").textContent = titles[viewName];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view-target]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.viewTarget)));
document.querySelectorAll("[data-jump]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.jump)));
document.querySelector("#task-search").addEventListener("input", renderTasks);
document.querySelector("#status-filter").addEventListener("change", renderTasks);
document.querySelector("#source-search").addEventListener("input", renderSources);
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault(); switchView("work"); document.querySelector("#task-search").focus();
  }
});

renderMetrics();
renderCriticalPath();
renderApprovals();
renderTasks();
renderRunsAndHandoffs();
renderAgents();
renderSources();
