const OPERATIONS_SHEET = "https://docs.google.com/spreadsheets/d/1oJxHk_FeDiZ3FUi3ugd2xheiJSrA9OgdRQn5EJgpN_w/edit";

const data = {
  snapshot: "2026-09-27",
  tasks: [
    { id: "WIS-SYS-001", stream: "Foundation", title: "Implementar la base multiagente", priority: "P0", owner: "wis-orchestrator", status: "DONE", dependency: "—", deliverable: "Contratos, baseline, tablero y dry-run", scope: "Repositorio raíz y tablero operativo", approval: "NO", next: "Iniciar auditoría WIS-REV-001", updated: "26/09/2026 20:05" },
    { id: "WIS-REV-001", stream: "Revenue", title: "Auditar distribuidoras provisionales", priority: "P0", owner: "growth-research", status: "READY", dependency: "WIS-SYS-001", deliverable: "Primer lote validado de 25 filas", scope: "Columnas comerciales existentes", approval: "NO", next: "Auditar filas provisionales y preparar lote 1/25", updated: "26/09/2026 20:05" },
    { id: "WIS-REV-002", stream: "Revenue", title: "Completar 300 distribuidoras argentinas", priority: "P0", owner: "growth-research", status: "BACKLOG", dependency: "WIS-REV-001", deliverable: "300 empresas únicas con QA", scope: "Columnas comerciales existentes", approval: "NO", next: "Procesar lotes de 25", updated: "26/09/2026 12:00" },
    { id: "WIS-LOG-001", stream: "Revenue", title: "Completar 300 logísticas de Latinoamérica", priority: "P1", owner: "growth-research", status: "BACKLOG", dependency: "WIS-REV-002", deliverable: "300 logísticas únicas con QA", scope: "Planilla comercial autorizada", approval: "NO", next: "Comenzar después de distribuidoras", updated: "26/09/2026 12:00" },
    { id: "WIS-WEB-001", stream: "Operations", title: "Crear dashboard general operativo", priority: "P1", owner: "web-brand", status: "REVIEW", dependency: "WIS-SYS-001", deliverable: "Dashboard responsive e informe de uso", scope: "sites/wis-operations-dashboard/** y docs/WIS_DASHBOARD_OPERATIVO.md", approval: "SI: despliegue", next: "QA independiente y solicitud de despliegue privado", updated: "27/09/2026" }
  ],
  runs: [
    { id: "RUN-WIS-SYS-001-001", task: "WIS-SYS-001", agent: "wis-orchestrator", status: "DONE", evidence: "Commit f3136c1 · tag baseline-multiagent-v1", tests: "Sistema 3/3 · dry-run OK · WIS X 25/25", finished: "26/09/2026 20:05" },
    { id: "RUN-WIS-WEB-001-001", task: "WIS-WEB-001", agent: "web-brand", status: "REVIEW", evidence: "Dashboard local y documento de uso preparados", tests: "JavaScript OK · desktop y móvil OK · consola sin errores", finished: "—" }
  ],
  approvals: [],
  handoffs: [
    { id: "HOF-WIS-SYS-001-001", task: "WIS-SYS-001", from: "qa-ops", to: "wis-orchestrator", status: "DONE", artifact: "docs/BASELINE_INVENTORY.md", evidence: "Repositorios anidados y artefactos generados identificados", next: "Iniciar WIS-REV-001 desde la planilla comercial" }
  ],
  agents: [
    { id: "wis-orchestrator", name: "Orquestador", kind: "orchestrator", color: "cyan", mission: "Descompone objetivos, asigna responsables, controla dependencias, aprobaciones e integración.", tags: ["cola", "dependencias", "integración"] },
    { id: "growth-research", name: "Research", kind: "specialist", color: "violet", mission: "Busca, enriquece y valida prospectos, contactos corporativos y reseñas con evidencia.", tags: ["prospectos", "Maps", "Sheets"] },
    { id: "commercial-activation", name: "Activación comercial", kind: "specialist", color: "violet", mission: "Prepara mensajes, follow-ups, calificación y propuestas sobre prospectos validados.", tags: ["WhatsApp", "email", "propuestas"] },
    { id: "content-strategy", name: "Contenido", kind: "specialist", color: "violet", mission: "Produce briefs, calendario editorial, casos y voz de marca basados en evidencia.", tags: ["briefs", "calendario", "casos"] },
    { id: "linkedin-operator", name: "LinkedIn", kind: "specialist", color: "violet", mission: "Mantiene borradores, aprobaciones, idempotencia y publicación controlada de LinkedIn.", tags: ["dry-run", "n8n", "aprobación"] },
    { id: "x-operator", name: "X", kind: "specialist", color: "violet", mission: "Mantiene el carril aislado de X con OAuth, reconciliación e idempotencia.", tags: ["X API", "dry-run", "reconciliación"] },
    { id: "web-brand", name: "Web y marca", kind: "specialist", color: "violet", mission: "Mantiene web, casos aprobados y activos visuales con QA responsive.", tags: ["web", "marca", "responsive"] },
    { id: "automation-integrations", name: "Automatizaciones", kind: "specialist", color: "violet", mission: "Mantiene n8n, conectores, esquemas, seguridad y observabilidad compartida.", tags: ["n8n", "Supabase", "infra"] },
    { id: "qa-ops", name: "QA Ops", kind: "qa", color: "amber", mission: "Realiza QA independiente, seguridad, regresiones, incidentes y aceptación.", tags: ["QA", "seguridad", "runbooks"] }
  ],
  conversations: [
    { title: "BUSQUEDA PROSPECTOS WIS", id: "01a011c6-ec79-7d32-b706-b4b73f9abdcb", agents: ["growth-research", "commercial-activation", "qa-ops"] },
    { title: "Crear propuesta para Doña Fransica", id: "01a08190-73c2-7090-88b1-8d2ff0463acc", agents: ["commercial-activation"] },
    { title: "Analiza sheet y plan de mails", id: "01a0654f-a185-7a43-a068-fcd39852b304", agents: ["commercial-activation"] },
    { title: "BOT PROSPECCION WIS WSP", id: "01a011c8-647b-71c1-8da8-d56f3d6412ae", agents: ["commercial-activation", "automation-integrations", "qa-ops"] },
    { title: "BOT LINKEDIN WIS", id: "01a011c5-b87b-76d2-9a75-07f9ddecd89f", agents: ["linkedin-operator", "automation-integrations", "qa-ops"] },
    { title: "Actualizar web de WIS Agency", id: "01a03b5f-4e3e-7de0-a636-def7c052ade9", agents: ["web-brand", "content-strategy"] },
    { title: "Construir WIS X Bot", id: "01a036e7-12d5-7e90-9215-df846c82d4c0", agents: ["x-operator", "qa-ops"] },
    { title: "Diseñar bot beta tester", id: "01a03992-3bf7-7bc3-a8b2-c16cce9fc2cf", agents: ["qa-ops"] },
    { title: "Arma calendario de contenidos WIS", id: "01a03fcf-7b51-7e50-961c-c7d75875f6c2", agents: ["content-strategy"] },
    { title: "Investiga bots de WhatsApp en GitHub", id: "01a03995-4c1c-7c31-b288-14370d6e62da", agents: ["commercial-activation", "automation-integrations", "qa-ops"] },
    { title: "Diseñar agente prospección B2B", id: "01a011c7-2686-7f32-8c25-b47ce2fba687", agents: ["growth-research", "commercial-activation"] },
    { title: "ORQUESTADOR BOT WIS", id: "01a011c8-321c-7ea1-a899-9997cf861579", agents: ["wis-orchestrator", "qa-ops"] }
  ]
};

const titles = { overview: "Visión general", work: "Trabajo operativo", agents: "Mapa de agentes", sources: "Conversaciones fuente" };

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const statusClass = status => ({ DONE: "pill-done", READY: "pill-ready", REVIEW: "pill-review", BACKLOG: "pill-backlog", WAITING_APPROVAL: "pill-waiting", BLOCKED: "pill-blocked" })[status] || "pill-backlog";
const statusLabel = status => status.replaceAll("_", " ");

function renderMetrics() {
  const done = data.tasks.filter(task => task.status === "DONE").length;
  const active = data.tasks.filter(task => ["READY", "IN_PROGRESS", "REVIEW"].includes(task.status)).length;
  const metrics = [
    { label: "Tareas totales", value: data.tasks.length, foot: `${done} completada · ${active} lista`, color: "#6ee7d2" },
    { label: "Aprobaciones", value: data.approvals.length, foot: "Sin acciones externas pendientes", color: "#8fdfa7" },
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
}

function renderAgents() {
  const colors = { cyan: "#6ee7d2", violet: "#b3a1ff", amber: "#f2c56b" };
  const kinds = { orchestrator: "Orquestación", specialist: "Especialista", qa: "QA independiente" };
  document.querySelector("#agent-grid").innerHTML = data.agents.map(agent => `
    <article class="agent-card" style="--agent-color:${colors[agent.color]}">
      <div class="agent-head"><span class="agent-code">${escapeHtml(agent.id)}</span><span class="agent-kind">${kinds[agent.kind]}</span></div>
      <h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.mission)}</p>
      <div class="agent-tags">${agent.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </article>`).join("");
}

function renderSources() {
  const query = document.querySelector("#source-search").value.trim().toLowerCase();
  const sources = data.conversations.filter(source => [source.title, source.id, ...source.agents].join(" ").toLowerCase().includes(query));
  document.querySelector("#source-grid").innerHTML = sources.length ? sources.map(source => `
    <article class="source-card"><h3>${escapeHtml(source.title)}</h3><span class="source-id">${escapeHtml(source.id)}</span><div class="source-agents">${source.agents.map(agent => `<span>${escapeHtml(agent)}</span>`).join("")}</div></article>`).join("") : `<div class="empty-state"><strong>No hay coincidencias</strong><p>Buscá por nombre, ID o agente asignado.</p></div>`;
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
renderTasks();
renderRunsAndHandoffs();
renderAgents();
renderSources();
