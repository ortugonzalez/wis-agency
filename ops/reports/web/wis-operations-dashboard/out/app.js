const data = {
  metrics: [
    { label: "Prospectos en cola", value: "0", note: "Las nuevas colas están vacías", tone: "cyan" },
    { label: "Envíos nuevos", value: "0", note: "Dry-run sin proveedores", tone: "green" },
    { label: "Aprobaciones activas", value: "0", note: "Canario aún no solicitado", tone: "amber" },
    { label: "Bloqueos técnicos", value: "4", note: "Antes del canario", tone: "red" }
  ],
  lanes: [
    { index: "01", name: "Research", owner: "prospect-research", lot: "N", status: "READY", copy: "300 distribuidoras → 300 logísticas LATAM", next: "Auditar lote inicial de 25" },
    { index: "02", name: "Copy", owner: "outreach-copy", lot: "N−1", status: "BACKLOG", copy: "Variantes A/B basadas en un problema", next: "Esperar research validado" },
    { index: "03", name: "Email", owner: "email-sender", lot: "N−2", status: "BLOCKED", copy: "5 emails para el canario", next: "Crear sender aislado y validar salud" },
    { index: "04", name: "WhatsApp", owner: "whatsapp-sender", lot: "N−2+", status: "BLOCKED", copy: "0–2 mensajes sólo con opt-in", next: "Hardening de WIS 03 y plantillas" }
  ],
  channels: [
    { name: "Email", provider: "Gmail / Brevo", health: "REVALIDAR", status: "blocked", volume: "25 por día", interval: "15 min · 09:30–17:30 BA", rules: ["Individual, sin CC/BCC", "Firma WIS sin Gravatar", "Follow-ups días 3 y 7 sólo aprobados"], risk: "No existe sender WIS aislado versionado." },
    { name: "WhatsApp", provider: "Kapso / MundoVera", health: "INACTIVO", status: "blocked", volume: "10 por día", interval: "15 min · 1 follow-up", rules: ["Email primero", "Opt-in verificable", "Template aprobado fuera de 24h"], risk: "WIS 03 requiere idempotencia y reconciliación." }
  ],
  agents: [
    { id: "wis-orchestrator", name: "Orquestador", mission: "Coordina lotes, dependencias, aprobaciones y salud de canal.", tags: ["lotes", "aprobaciones", "integración"] },
    { id: "prospect-research", name: "Research", mission: "Encuentra y valida prospectos medianos o chicos con evidencia pública.", tags: ["Maps", "reseñas 1–3", "contactos"] },
    { id: "outreach-copy", name: "Copy", mission: "Redacta email y WhatsApp personalizados con variantes A/B.", tags: ["A/B", "prototipo", "dos horarios"] },
    { id: "email-sender", name: "Email", mission: "Encola y monitorea emails aprobados con límites e idempotencia.", tags: ["Gmail", "Brevo", "25/día"] },
    { id: "whatsapp-sender", name: "WhatsApp", mission: "Procesa sólo contactos con opt-in mediante workflows WIS.", tags: ["opt-in", "24h", "10/día"] },
    { id: "qa-ops", name: "QA Ops", mission: "Valida datos, copy, aprobación, idempotencia y pausas.", tags: ["independiente", "seguridad", "evidencia"] }
  ],
  states: ["NUEVO", "RESEARCH", "VALIDADO", "BORRADOR", "QA", "APROBACIÓN", "EN COLA", "ENVIADO", "RESPONDIDO", "CERRADO"]
};

const esc = value => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
const statusClass = status => status === "READY" ? "status-ready" : status === "BLOCKED" ? "status-blocked" : "status-backlog";

document.querySelector("#metrics").innerHTML = data.metrics.map(item => `<article class="metric ${item.tone}"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.note)}</small></article>`).join("");
document.querySelector("#lanes").innerHTML = data.lanes.map(item => `<article class="lane"><span class="lane-index">${item.index}</span><div><div class="lane-top"><strong>${esc(item.name)}</strong><span class="status ${statusClass(item.status)}">${item.status}</span></div><p>${esc(item.copy)}</p><small>${esc(item.owner)} · lote ${esc(item.lot)}</small></div></article>`).join("");

function renderPipeline() {
  const filter = document.querySelector("#pipeline-filter").value;
  const rows = data.lanes.filter(item => filter === "ALL" || item.status === filter);
  document.querySelector("#pipeline-body").innerHTML = rows.map(item => `<tr><td><strong>Lote ${esc(item.lot)}</strong></td><td>${esc(item.name)}</td><td><code>${esc(item.owner)}</code></td><td><span class="status ${statusClass(item.status)}">${item.status}</span></td><td>${esc(item.copy)}</td><td>${esc(item.next)}</td></tr>`).join("");
}
document.querySelector("#pipeline-filter").addEventListener("change", renderPipeline);
renderPipeline();

document.querySelector("#state-flow").innerHTML = data.states.map((state, index) => `<span><b>${String(index + 1).padStart(2, "0")}</b>${esc(state)}</span>`).join("");
document.querySelector("#channel-grid").innerHTML = data.channels.map(channel => `<article class="channel-card"><div class="channel-head"><div><p class="eyebrow">${esc(channel.provider)}</p><h3>${esc(channel.name)}</h3></div><span class="status status-blocked">${esc(channel.health)}</span></div><div class="channel-numbers"><div><strong>${esc(channel.volume)}</strong><span>Límite</span></div><div><strong>${esc(channel.interval)}</strong><span>Cadencia</span></div></div><ul>${channel.rules.map(rule => `<li>${esc(rule)}</li>`).join("")}</ul><p class="risk">${esc(channel.risk)}</p></article>`).join("");
document.querySelector("#agent-grid").innerHTML = data.agents.map(agent => `<article class="agent"><code>${esc(agent.id)}</code><h3>${esc(agent.name)}</h3><p>${esc(agent.mission)}</p><div>${agent.tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div></article>`).join("");

const titles = { overview: "Resumen comercial", pipeline: "Pipeline por lote", channels: "Canales y salud", agents: "Roles activos" };
function switchView(id) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("is-active", view.id === id));
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("is-active", button.dataset.view === id));
  document.querySelector("#page-title").textContent = titles[id];
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
