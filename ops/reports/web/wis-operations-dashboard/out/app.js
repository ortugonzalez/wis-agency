const data = {
  metrics: [
    { label: "Prospectos en cola", value: "0", note: "Colas operativas vacías", tone: "teal", icon: "Q" },
    { label: "Envíos realizados", value: "0", note: "Sin llamadas a proveedores", tone: "blue", icon: "↗" },
    { label: "Aprobaciones activas", value: "0", note: "Canario no solicitado", tone: "amber", icon: "A" },
    { label: "Bloqueos técnicos", value: "4", note: "Requeridos antes de enviar", tone: "red", icon: "!" }
  ],
  lanes: [
    { index: "01", name: "Research", owner: "prospect-research", lot: "N", status: "READY", copy: "Validar 300 distribuidoras y luego 300 logísticas LATAM.", next: "Auditar lote inicial de 25" },
    { index: "02", name: "Copy", owner: "outreach-copy", lot: "N−1", status: "BACKLOG", copy: "Crear variantes A/B a partir de un único problema comprobado.", next: "Esperar research validado" },
    { index: "03", name: "Email", owner: "email-sender", lot: "N−2", status: "BLOCKED", copy: "Preparar cinco correos para el primer canario controlado.", next: "Crear sender y validar salud" },
    { index: "04", name: "WhatsApp", owner: "whatsapp-sender", lot: "N−2+", status: "BLOCKED", copy: "Continuar sólo con contactos que tengan opt-in verificable.", next: "Endurecer workflow y plantillas" }
  ],
  blockers: [
    { title: "Sender email WIS aislado", detail: "Crear un flujo propio, versionado y separado de otros proyectos.", owner: "email-sender" },
    { title: "Salud de Gmail y Brevo", detail: "Revalidar alias, firma, reply-to, SPF, DKIM y DMARC.", owner: "email-sender" },
    { title: "Idempotencia en WhatsApp", detail: "Persistir intentos, conciliar timeouts y evitar reintentos ciegos.", owner: "whatsapp-sender" },
    { title: "Ventana de 24 h y plantillas", detail: "Confirmar opt-in y plantillas aprobadas por el proveedor.", owner: "whatsapp-sender" }
  ],
  guardrails: [
    { value: "Auth", title: "Falla de autenticación", detail: "Pausa inmediata del lote" },
    { value: "Spam", title: "Queja reportada", detail: "Pausa inmediata del lote" },
    { value: ">2%", title: "Hard bounce", detail: "Detiene el canal de email" },
    { value: "Opt-out", title: "Pedido de baja", detail: "Cierra el contacto" }
  ],
  channels: [
    { name: "Email", provider: "Gmail / Brevo", health: "REVALIDAR", volume: "25 por día", interval: "15 min · 09:30–17:30 BA", rules: ["Envío individual, sin CC/BCC", "Firma HTML WIS sin Gravatar", "Follow-ups de días 3 y 7 sólo si fueron aprobados"], risk: "Todavía no existe un sender WIS aislado y versionado." },
    { name: "WhatsApp", provider: "Kapso / MundoVera", health: "INACTIVO", volume: "10 por día", interval: "15 min · 1 follow-up", rules: ["Email como primer canal", "Opt-in verificable y registrado", "Template aprobado fuera de la ventana de 24 horas"], risk: "WIS 03 requiere idempotencia y reconciliación persistentes." }
  ],
  agents: [
    { id: "wis-orchestrator", initials: "WO", name: "Orquestador", mission: "Coordina lotes, dependencias, aprobaciones y salud de canal.", tags: ["lotes", "aprobaciones", "integración"] },
    { id: "prospect-research", initials: "PR", name: "Prospect Research", mission: "Encuentra y valida prospectos medianos o chicos con evidencia pública.", tags: ["Maps", "reseñas 1–3", "contactos"] },
    { id: "outreach-copy", initials: "OC", name: "Outreach Copy", mission: "Redacta mensajes personalizados y controla las variantes A/B.", tags: ["A/B", "prototipo", "dos horarios"] },
    { id: "email-sender", initials: "ES", name: "Email Sender", mission: "Encola y monitorea correos aprobados con límites e idempotencia.", tags: ["Gmail", "Brevo", "25/día"] },
    { id: "whatsapp-sender", initials: "WS", name: "WhatsApp Sender", mission: "Procesa únicamente contactos con consentimiento verificable.", tags: ["opt-in", "24 h", "10/día"] },
    { id: "qa-ops", initials: "QA", name: "QA Operations", mission: "Controla datos, copy, permisos, duplicados y pausas de seguridad.", tags: ["independiente", "seguridad", "evidencia"] }
  ],
  states: ["NUEVO", "RESEARCH_EN_CURSO", "RESEARCH_VALIDADO", "BORRADOR", "QA", "ESPERANDO_APROBACION", "APROBADO", "EN_COLA", "ENVIADO", "RESPONDIDO / CERRADO"],
  readiness: [
    { group: "Fundación operativa", status: "DONE", title: "Roles y permisos comerciales", detail: "Seis roles activos, rutas acotadas y aprobación humana obligatoria." },
    { group: "Fundación operativa", status: "DONE", title: "Cola e historial de eventos", detail: "Outreach_Queue y Outreach_Events creadas con claves idempotentes." },
    { group: "Fundación operativa", status: "DONE", title: "Dry-run de 25 prospectos", detail: "Evidencia local al corte: npm test 10/10 y cero llamadas a proveedores externos." },
    { group: "Bloqueos antes del canario", status: "CRITICAL", title: "Implementar sender email WIS aislado", detail: "No reutilizar workflows pertenecientes a otros proyectos." },
    { group: "Bloqueos antes del canario", status: "CRITICAL", title: "Revalidar Gmail y Brevo", detail: "Alias, reply-to, firma, SPF, DKIM, DMARC y entregabilidad." },
    { group: "Bloqueos antes del canario", status: "CRITICAL", title: "Endurecer workflow WIS de WhatsApp", detail: "Idempotencia persistente, reconciliación y registro de opt-in." },
    { group: "Bloqueos antes del canario", status: "CRITICAL", title: "Confirmar plantillas y ventana de 24 h", detail: "Validar IDs aprobados mediante snapshot del proveedor." },
    { group: "Activación controlada", status: "PENDING", title: "Preparar lote de research con QA", detail: "Seleccionar 25 prospectos con contactos verificables y mensajes A/B." },
    { group: "Activación controlada", status: "PENDING", title: "Registrar aprobación humana del canario", detail: "Aprobar exactamente 5 emails y hasta 2 WhatsApp con opt-in." },
    { group: "Activación controlada", status: "PENDING", title: "Ejecutar, medir y decidir escala", detail: "Controlar entrega, respuestas, rebotes, duplicados y bajas antes de ampliar." }
  ]
};

const esc = value => String(value).replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
const statusClass = status => status === "READY" || status === "DONE" ? "status-ready" : status === "BLOCKED" || status === "CRITICAL" ? "status-blocked" : status === "REVIEW" ? "status-review" : "status-backlog";
const statusLabel = status => ({ DONE:"LISTO", CRITICAL:"CRÍTICO", PENDING:"PENDIENTE" })[status] || status;

document.querySelector("#metrics").innerHTML = data.metrics.map(item => `<article class="metric ${item.tone}"><div class="metric-head"><span class="metric-label">${esc(item.label)}</span><span class="metric-icon" aria-hidden="true">${esc(item.icon)}</span></div><strong class="metric-value">${esc(item.value)}</strong><span class="metric-note">${esc(item.note)}</span></article>`).join("");
document.querySelector("#lanes").innerHTML = data.lanes.map(item => `<article class="lane"><div class="lane-number"><span>${esc(item.index)}</span><span class="status ${statusClass(item.status)}">${esc(item.status)}</span></div><h3>${esc(item.name)}</h3><p>${esc(item.copy)}</p><div class="lane-footer"><strong>${esc(item.owner)}</strong>Lote ${esc(item.lot)}</div></article>`).join("");
document.querySelector("#blocker-list").innerHTML = data.blockers.map((item, index) => `<article class="blocker"><span class="blocker-index">${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div><em>${esc(item.owner)}</em></article>`).join("");
document.querySelector("#guardrails").innerHTML = data.guardrails.map(item => `<article class="guardrail"><span>${esc(item.value)}</span><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></article>`).join("");

function renderPipeline() {
  const filter = document.querySelector("#pipeline-filter").value;
  const rows = data.lanes.filter(item => filter === "ALL" || item.status === filter);
  document.querySelector("#pipeline-body").innerHTML = rows.map(item => `<tr><td><strong>Lote ${esc(item.lot)}</strong></td><td>${esc(item.name)}</td><td><code>${esc(item.owner)}</code></td><td><span class="status ${statusClass(item.status)}">${esc(item.status)}</span></td><td>${esc(item.copy)}</td><td>${esc(item.next)}</td></tr>`).join("");
}
document.querySelector("#pipeline-filter").addEventListener("change", renderPipeline);
renderPipeline();

document.querySelector("#state-flow").innerHTML = data.states.map((state, index) => `${index ? '<span class="state-arrow" aria-hidden="true">→</span>' : ''}<span class="state-node"><b>${String(index + 1).padStart(2, "0")}</b>${esc(state)}</span>`).join("");
document.querySelector("#channel-grid").innerHTML = data.channels.map(channel => `<article class="channel-card"><div class="channel-head"><div><p class="channel-provider">${esc(channel.provider)}</p><h3>${esc(channel.name)}</h3></div><span class="status status-blocked">${esc(channel.health)}</span></div><div class="channel-stats"><div><strong>${esc(channel.volume)}</strong><span>Límite inicial</span></div><div><strong>${esc(channel.interval)}</strong><span>Cadencia</span></div></div><ul class="rule-list">${channel.rules.map(rule => `<li>${esc(rule)}</li>`).join("")}</ul><p class="risk-note">${esc(channel.risk)}</p></article>`).join("");
document.querySelector("#agent-grid").innerHTML = data.agents.map(agent => `<article class="agent-card"><span class="agent-avatar" aria-hidden="true">${esc(agent.initials)}</span><code>${esc(agent.id)}</code><h3>${esc(agent.name)}</h3><p>${esc(agent.mission)}</p><div class="tag-row">${agent.tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div></article>`).join("");

const groupedReadiness = Object.groupBy ? Object.groupBy(data.readiness, item => item.group) : data.readiness.reduce((groups, item) => ((groups[item.group] ||= []).push(item), groups), {});
document.querySelector("#readiness-list").innerHTML = Object.entries(groupedReadiness).map(([group, items]) => `<section class="check-group"><div class="check-group-title"><h3>${esc(group)}</h3><span>${items.filter(item => item.status === "DONE").length}/${items.length} completos</span></div>${items.map(item => `<article class="check-item ${item.status === "DONE" ? "is-done" : item.status === "CRITICAL" ? "is-critical" : ""}"><span class="check-marker" aria-hidden="true">${item.status === "DONE" ? "✓" : item.status === "CRITICAL" ? "!" : "○"}</span><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div><span class="status ${statusClass(item.status)}">${statusLabel(item.status)}</span></article>`).join("")}</section>`).join("");

const titles = { overview:"Resumen ejecutivo", pipeline:"Pipeline por lote", channels:"Canales y salud", agents:"Equipo agente", readiness:"Puesta en marcha" };
function switchView(id) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("is-active", view.id === id));
  document.querySelectorAll("[data-view]").forEach(button => {
    const isActive = button.dataset.view === id;
    button.classList.toggle("is-active", isActive);
    if (isActive) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  document.querySelector("#page-title").textContent = titles[id];
  history.replaceState(null, "", `#${id}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", event => { event.preventDefault(); switchView(button.dataset.view); }));
const requestedView = location.hash.slice(1);
if (titles[requestedView]) switchView(requestedView);
