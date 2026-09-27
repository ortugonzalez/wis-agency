const fallback = {
  generatedAt: "2026-09-27T00:00:00-03:00", mode: "DRY_RUN",
  commercial: { prospects:149, whatsapp:88, web:148, email:94, reviews:149, analysis:149, whatsappDrafts:149, emailDrafts:149 },
  legacyEmail: { managed:59, sent:50, withoutKnownBounce:49, softBounces:1, hardBounces:0, duplicatesSkipped:1, positiveReplies:0, meetings:0 },
  newPipeline: { queued:0, sent:0, activeApprovals:0, outcomeUnknown:0 },
  qa: { batch:"Distribuidoras_300 · filas 2–26", pass:0, review:8, discard:17, notes:["25/25 registros no expresan reseñas como analizadas/total accesible.","25/25 borradores requieren adaptación al contrato comercial vigente.","17/25 registros son corporaciones o quedan fuera del foco mediana/chica."] },
  channels: {
    email:{ provider:"Gmail / Brevo", account:"Ortu - WIS <ortu@wis-agency.com>", health:"BLOCKED", enabled:false, canSend:false, detail:"Alias, DKIM/SPF y firma aprobada aún no verificables." },
    whatsapp:{ provider:"Baileys · conexión no oficial", account:"línea •••• 5679", health:"HARDENED_OFF", enabled:false, canSend:false, detail:"Controles listos; sesión y transporte desactivados." }
  },
  sheets:{ queueRows:59, eventRows:52 }, schedules:[], commands:[]
};

const staticData = {
  lanes: [
    { lot:"N", name:"Research", owner:"prospect-research", status:"IN_PROGRESS", next:"Reemplazar 17 filas y recapturar 8" },
    { lot:"N−1", name:"Copy", owner:"outreach-copy", status:"BLOCKED", next:"Esperar research validado" },
    { lot:"N−2", name:"Email", owner:"email-sender", status:"BLOCKED", next:"Verificar alias, DNS y firma" },
    { lot:"N−2+", name:"WhatsApp", owner:"whatsapp-sender", status:"READY_OFF", next:"Conectar transporte y probar sesión 5679" }
  ],
  states: ["NUEVO","RESEARCH_EN_CURSO","RESEARCH_VALIDADO","BORRADOR","QA","ESPERANDO_APROBACION","APROBADO","EN_COLA","ENVIADO","RESPONDIDO / CERRADO"],
  readiness: [
    { group:"Listo", status:"DONE", title:"Historial cargado", detail:"59 registros y 52 eventos importados con fuente de origen." },
    { group:"Listo", status:"DONE", title:"WhatsApp endurecido", detail:"Idempotencia, opt-in, bajas, límites y OUTCOME_UNKNOWN implementados; disabled." },
    { group:"Listo", status:"DONE", title:"Sender email aislado", detail:"Runtime y workflow desactivados, fail-closed y con pruebas offline." },
    { group:"Antes del canario", status:"CRITICAL", title:"Revalidar Gmail/Brevo con acceso autenticado", detail:"Alias, credencial exclusiva, firma HTML, SPF/DKIM y transporte." },
    { group:"Antes del canario", status:"CRITICAL", title:"Sanear el lote de 25", detail:"0 PASS, 8 REVIEW y 17 DISCARD en el primer corte." },
    { group:"Antes del canario", status:"CRITICAL", title:"Conectar el transporte WhatsApp 5679", detail:"La implementación no contiene adaptador ni secretos y permanece apagada." },
    { group:"Mañana", status:"PENDING", title:"Elegir el canario", detail:"Seleccionar 5 emails y hasta 2 WhatsApp con opt-in." },
    { group:"Mañana", status:"PENDING", title:"Registrar aprobación humana", detail:"Alcance exacto, variantes, destinatarios y follow-ups." }
  ]
};

const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
const statusClass = status => /DONE|READY|ACTIVE|HARDENED/.test(status) ? "status-ready" : /BLOCKED|CRITICAL|REVALID|DISCARD/.test(status) ? "status-blocked" : "status-backlog";
const pct = (value,total) => total ? Math.round(value / total * 100) : 0;
let state = fallback;

function metric(label,value,note,tone="teal") { return `<article class="metric ${tone}"><div class="metric-head"><span class="metric-label">${esc(label)}</span></div><strong class="metric-value">${esc(value)}</strong><span class="metric-note">${esc(note)}</span></article>`; }

function render() {
  const c=state.commercial, l=state.legacyEmail, n=state.newPipeline, q=state.qa;
  document.querySelector("#snapshot-date").textContent = new Date(state.serverTime || state.generatedAt).toLocaleString("es-AR",{dateStyle:"medium",timeStyle:"short"});
  document.querySelector("#metrics").innerHTML = [metric("Prospectos cargados",c.prospects,"Distribuidoras_300","teal"),metric("Emails históricos",l.sent,"Actividad previa importada","blue"),metric("Lote QA aprobado",`${q.pass}/25`,`${q.review} revisar · ${q.discard} descartar`,"red"),metric("Envíos nuevos",n.sent,"Proveedores bloqueados","amber")].join("");
  document.querySelector("#activity-metrics").innerHTML = [metric("Gestionados",l.managed,"Historial previo","blue"),metric("Sin rebote conocido",l.withoutKnownBounce,"No equivale a inbox","teal"),metric("Rebotes blandos",l.softBounces,"No reenviar sin validar","red"),metric("Respuestas positivas",l.positiveReplies,"Objetivo principal","amber")].join("");
  document.querySelector("#history-summary").innerHTML = `<div class="history-number"><strong>${l.sent}</strong><span>enviados</span></div><div class="history-stat"><b>${l.withoutKnownBounce}</b><span>sin rebote registrado</span></div><div class="history-stat"><b>${l.softBounces}</b><span>rebote blando</span></div><div class="history-stat"><b>${l.duplicatesSkipped}</b><span>duplicado omitido</span></div>`;
  const channels=Object.entries(state.channels);
  document.querySelector("#channel-mini").innerHTML = channels.map(([key,x])=>`<article class="mini-health"><span class="signal ${x.canSend?"signal-teal":"signal-red"}"></span><div><strong>${esc(key === "email" ? "Email" : "WhatsApp · 5679")}</strong><p>${esc(x.detail)}</p></div><em class="status ${statusClass(x.health)}">${esc(x.health)}</em></article>`).join("");
  document.querySelector("#coverage-grid").innerHTML = [["WhatsApp",c.whatsapp],["Web",c.web],["Email",c.email],["Reseñas",c.reviews],["Análisis",c.analysis],["Borrador WA",c.whatsappDrafts],["Borrador email",c.emailDrafts]].map(([name,value])=>`<article class="coverage-card"><div><strong>${esc(value)}</strong><span>/ ${c.prospects}</span></div><p>${esc(name)}</p><div class="coverage-track"><span style="width:${pct(value,c.prospects)}%"></span></div></article>`).join("");
  document.querySelector("#qa-bars").innerHTML = [["PASS",q.pass,"pass"],["REVIEW",q.review,"review"],["DISCARD",q.discard,"discard"]].map(([label,value,kind])=>`<div class="qa-row"><span>${label}</span><div><i class="${kind}" style="width:${pct(value,25)}%"></i></div><strong>${value}</strong></div>`).join("");
  document.querySelector("#qa-notes").innerHTML = q.notes.map((note,i)=>`<article><span>0${i+1}</span><p>${esc(note)}</p></article>`).join("");
  document.querySelector("#activity-body").innerHTML = [["Emails enviados",l.sent,"Historial previo importado"],["Entregas sin rebote",l.withoutKnownBounce,"No confirma bandeja de entrada"],["Rebote blando",l.softBounces,"Brevo / reputación IP"],["Duplicado omitido",l.duplicatesSkipped,"Protección idempotente"],["Eventos del ledger",state.sheets?.eventRows || 0,"Registro append-only"],["Mensajes nuevos",n.sent,"Desde este sistema"]].map(row=>`<tr><td><strong>${esc(row[0])}</strong></td><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join("");
  document.querySelector("#pipeline-body").innerHTML = staticData.lanes.map(x=>`<tr><td><strong>Lote ${esc(x.lot)}</strong></td><td>${esc(x.name)}</td><td><code>${esc(x.owner)}</code></td><td><span class="status ${statusClass(x.status)}">${esc(x.status)}</span></td><td>${esc(x.next)}</td></tr>`).join("");
  document.querySelector("#state-flow").innerHTML = staticData.states.map((x,i)=>`${i?'<span class="state-arrow">→</span>':''}<span class="state-node"><b>${String(i+1).padStart(2,"0")}</b>${esc(x)}</span>`).join("");
  document.querySelector("#channel-grid").innerHTML = channels.map(([key,x])=>`<article class="channel-card"><div class="channel-head"><div><p class="channel-provider">${esc(x.provider)}</p><h3>${key === "email" ? "Email" : "WhatsApp"}</h3></div><span class="status ${statusClass(x.health)}">${esc(x.health)}</span></div><div class="channel-stats"><div><strong>${esc(x.account)}</strong><span>Cuenta</span></div><div><strong>${x.canSend?"Sí":"No"}</strong><span>Puede enviar</span></div></div><p class="risk-note">${esc(x.detail)}</p></article>`).join("");
  renderCommands(); renderSchedules(); renderReadiness();
}

function renderCommands() {
  const list=state.commands || [];
  document.querySelector("#command-log").innerHTML = list.length ? list.map(x=>`<article><span class="status status-backlog">${esc(x.status)}</span><div><strong>${esc(x.action)}</strong><p>${esc(x.scope)} · ${new Date(x.createdAt).toLocaleString("es-AR")}</p></div><code>${esc(x.commandId)}</code></article>`).join("") : `<div class="empty-row">Todavía no hay órdenes registradas desde el panel.</div>`;
}

function renderSchedules() {
  const schedules=state.schedules || [];
  document.querySelector("#schedule-grid").innerHTML = schedules.length ? schedules.map(x=>`<article class="schedule-card"><div><span class="status ${x.status === "ACTIVE" ? "status-ready" : "status-backlog"}">${esc(x.status)}</span><strong>${esc(x.name)}</strong><p>${x.mode === "DAILY" ? `Todos los días · ${esc(x.dailyTime)}` : `Cada ${esc(x.intervalMinutes)} minutos`}</p></div><div class="schedule-actions"><button data-schedule="${esc(x.id)}" data-status="${x.status === "ACTIVE" ? "PAUSED" : "ACTIVE"}" class="button button-secondary">${x.status === "ACTIVE" ? "Pausar" : "Activar"}</button></div></article>`).join("") : `<div class="empty-row">Abrí el panel con <code>npm run dashboard:start</code> para administrar horarios.</div>`;
  document.querySelectorAll("[data-schedule]").forEach(button=>button.addEventListener("click",()=>updateSchedule(button.dataset.schedule,button.dataset.status)));
}

function renderReadiness() {
  const groups=staticData.readiness.reduce((a,x)=>((a[x.group] ||= []).push(x),a),{});
  document.querySelector("#readiness-list").innerHTML = Object.entries(groups).map(([name,items])=>`<section class="check-group"><div class="check-group-title"><h3>${esc(name)}</h3><span>${items.filter(x=>x.status==="DONE").length}/${items.length}</span></div>${items.map(x=>`<article class="check-item ${x.status === "DONE" ? "is-done" : x.status === "CRITICAL" ? "is-critical" : ""}"><span class="check-marker">${x.status === "DONE" ? "✓" : x.status === "CRITICAL" ? "!" : "○"}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p></div><span class="status ${statusClass(x.status)}">${esc(x.status)}</span></article>`).join("")}</section>`).join("");
}

async function loadState() {
  try {
    const response=await fetch("/api/state",{cache:"no-store"});
    if(!response.ok) throw new Error("offline");
    state=await response.json();
    document.querySelector("#connection-label").textContent="LOCAL LIVE";
  } catch {
    state=fallback;
    document.querySelector("#connection-label").textContent="SNAPSHOT";
  }
  render();
}

async function enqueue(action) {
  const notice=document.querySelector("#action-notice");
  notice.textContent="Registrando orden…";
  try {
    const response=await fetch("/api/actions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,scope:"NEXT_PENDING_BATCH"})});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || "ERROR");
    notice.textContent=`Orden ${result.command.commandId} registrada. No se realizó ningún envío.`;
    await loadState();
  } catch { notice.textContent="Para usar los botones, iniciá el panel con: npm run dashboard:start"; }
}

async function updateSchedule(id,status) {
  const current=(state.schedules || []).find(x=>x.id===id);
  if(!current) return;
  const response=await fetch(`/api/schedules/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({...current,status})});
  if(response.ok) await loadState();
}

const titles={overview:"Resumen ejecutivo",data:"Datos unificados",activity:"Actividad e historial",pipeline:"Pipeline por lote",channels:"Salud de canales",controls:"Controles y automatización",readiness:"Puesta en marcha"};
function switchView(id){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("is-active",x.id===id));document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("is-active",x.dataset.view===id));document.querySelector("#page-title").textContent=titles[id];history.replaceState(null,"",`#${id}`);window.scrollTo({top:0,behavior:"smooth"});}
document.querySelectorAll("[data-view]").forEach(x=>x.addEventListener("click",e=>{e.preventDefault();switchView(x.dataset.view);}));
document.querySelectorAll("[data-action]").forEach(x=>x.addEventListener("click",()=>enqueue(x.dataset.action)));
document.querySelector("#refresh-button").addEventListener("click",loadState);
if(titles[location.hash.slice(1)]) switchView(location.hash.slice(1));
loadState();
