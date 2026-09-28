const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const PAGE_SIZE = 18;

const store = {
  data: { prospects:[], events:[], queue:[], stats:{}, channels:{}, sync:{} },
  filtered: [],
  page: 1,
  selected: null,
  messageChannel: "EMAIL",
  loading: false
};

function toast(message, error=false) {
  const node=$("#toast");
  node.textContent=message;
  node.classList.toggle("is-error",error);
  node.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>node.classList.remove("is-visible"),3200);
}

async function copy(value, label="Dato") {
  if (!value) return toast(`${label} no disponible`,true);
  try { await navigator.clipboard.writeText(value); toast(`${label} copiado al portapapeles`); }
  catch { toast("El navegador no permitió copiar automáticamente.",true); }
}

function relativeDate(value) {
  if (!value) return "sin sincronizar";
  const date=new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const seconds=Math.round((date-Date.now())/1000);
  const formatter=new Intl.RelativeTimeFormat("es",{numeric:"auto"});
  if (Math.abs(seconds)<60) return formatter.format(seconds,"second");
  const minutes=Math.round(seconds/60);
  if (Math.abs(minutes)<60) return formatter.format(minutes,"minute");
  const hours=Math.round(minutes/60);
  if (Math.abs(hours)<24) return formatter.format(hours,"hour");
  return date.toLocaleString("es-AR",{dateStyle:"medium",timeStyle:"short"});
}

function prospectStatus(prospect) {
  if (/ENVIADO|DELIVERED|SENT|RESPONDIDO|CERRADO/i.test(prospect.lastStatus || "")) return "sent";
  const coverage=/^\s*\d+\s*\/\s*\d+\s*$/.test(prospect.reviewsAnalyzed || "");
  if (coverage && prospect.analysis && prospect.problems && (prospect.emailMessage || prospect.whatsappMessage)) return "ready";
  return "needs-work";
}

function statusBadge(prospect) {
  const status=prospectStatus(prospect);
  if(status==="sent") return '<span class="status status-sent">Contactado</span>';
  if(status==="ready") return '<span class="status status-ready">Listo para revisar</span>';
  return '<span class="status status-review">Requiere trabajo</span>';
}

function metric(label,value,note,tone="") {
  return `<article class="metric ${tone}"><span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
}

function renderMetrics() {
  const s=store.data.stats || {};
  $("#metrics").innerHTML=[
    metric("Prospectos",s.prospects ?? store.data.prospects.length,"Fuente: Distribuidoras_300"),
    metric("Con ambos canales",s.bothChannels ?? 0,"Email + WhatsApp","blue"),
    metric("Listos para revisar",s.ready ?? 0,"Cobertura de reseñas completa","amber"),
    metric("Contactados",s.contacted ?? 0,"Historial consolidado","red")
  ].join("");
  $("#activity-metrics").innerHTML=[
    metric("Cola",s.queued ?? store.data.queue.length,"Outreach_Queue en vivo","blue"),
    metric("Emails enviados",s.emailSent ?? 0,"Histórico + nuevos"),
    metric("Bloqueados",s.blocked ?? 0,"Sin riesgo de salida","amber"),
    metric("Rebotados",s.bounced ?? 0,"Requieren revisión","red")
  ].join("");
  $("#nav-prospect-count").textContent=s.prospects ?? store.data.prospects.length;
  $("#nav-activity-count").textContent=s.events ?? store.data.events.length;
}

function populateRubroFilter() {
  const current=$("#filter-rubro").value;
  const rubros=[...new Set(store.data.prospects.map(row=>row.rubro).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  $("#filter-rubro").innerHTML='<option value="">Todos</option>'+rubros.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  if(rubros.includes(current)) $("#filter-rubro").value=current;
}

function applyFilters(resetPage=true) {
  if(resetPage) store.page=1;
  const query=normalize($("#search").value);
  const rubro=$("#filter-rubro").value;
  const contact=$("#filter-contact").value;
  const status=$("#filter-status").value;
  store.filtered=store.data.prospects.filter(row=>{
    const haystack=normalize([row.empresa,row.rubro,row.ubicacion,row.email,row.whatsapp,row.problems,row.analysis].join(" "));
    const contactMatch=!contact || (contact==="email"&&row.email) || (contact==="whatsapp"&&row.whatsapp) ||
      (contact==="both"&&row.email&&row.whatsapp) || (contact==="missing"&&(!row.email||!row.whatsapp));
    return (!query||haystack.includes(query)) && (!rubro||row.rubro===rubro) && contactMatch && (!status||prospectStatus(row)===status);
  });
  renderTable();
}

function waCopyValue(prospect) {
  return prospect.whatsappE164 || String(prospect.whatsapp||"").split("(")[0].trim();
}

function sendBlocker(prospect,channelName) {
  const isWa=channelName==="WHATSAPP";
  const recipient=isWa?prospect.whatsapp:prospect.email;
  if(!recipient) return "RECIPIENT_MISSING";
  if(isWa&&!prospect.whatsappE164) return "WHATSAPP_PHONE_INVALID";
  const gate=prospect.eligibility?.[channelName]||{eligible:false,reason:"INDEPENDENT_QA_REQUIRED"};
  if(!gate.eligible) return gate.reason;
  if(isWa&&!prospect.whatsappOptIn?.eligible) return prospect.whatsappOptIn?.reason||"DURABLE_OPTIN_REQUIRED";
  const channel=store.data.channels?.[isWa?"whatsapp":"email"]||{};
  if(!channel.canSend) return isWa?"WHATSAPP_PROVIDER_NOT_CONFIGURED":"EMAIL_PROVIDER_NOT_CONFIGURED";
  return "";
}

function contactChip(type,value,row,copyValue=value) {
  if(!value) return "";
  const label=type==="email"?"Email":"WhatsApp";
  return `<button class="copy-chip" data-copy="${esc(copyValue)}" data-copy-label="${label}" data-row="${row}"><i>${type==="email"?"@":"◉"}</i><span>${esc(value)}</span></button>`;
}

function renderTable() {
  const pages=Math.max(1,Math.ceil(store.filtered.length/PAGE_SIZE));
  store.page=Math.min(store.page,pages);
  const start=(store.page-1)*PAGE_SIZE;
  const rows=store.filtered.slice(start,start+PAGE_SIZE);
  $("#result-count").textContent=`${store.filtered.length} de ${store.data.prospects.length} prospectos`;
  $("#page-label").textContent=`Página ${store.page} de ${pages} · ${store.filtered.length} resultados`;
  $("#page-prev").disabled=store.page<=1;
  $("#page-next").disabled=store.page>=pages;
  $("#prospect-body").innerHTML=rows.length ? rows.map(row=>`
    <tr data-open-row="${row.rowNumber}">
      <td><div class="company-cell"><span class="company-avatar">${esc((row.empresa||"?").slice(0,1).toUpperCase())}</span><div><strong>${esc(row.empresa||"Sin nombre")}</strong><small>Fila ${esc(row.rowNumber)}</small></div></div></td>
      <td><div class="rubric-cell"><strong>${esc(row.rubro||"Sin rubro")}</strong><span>${esc(row.ubicacion||"Sin ubicación")}</span></div></td>
      <td><div class="contact-stack">${contactChip("email",row.email,row.rowNumber)}${contactChip("whatsapp",row.whatsapp,row.rowNumber,waCopyValue(row))}${!row.email&&!row.whatsapp?'<span>Sin contacto verificable</span>':""}</div></td>
      <td><div class="problem-cell"><p>${esc(row.problems||row.analysis||"Análisis pendiente")}</p></div></td>
      <td>${statusBadge(row)}</td>
      <td><button class="row-button" data-open="${row.rowNumber}" aria-label="Abrir ficha de ${esc(row.empresa)}">→</button></td>
    </tr>`).join("") : '<tr><td colspan="6" class="empty-state">No hay prospectos que coincidan con estos filtros.</td></tr>';
  $$("[data-copy]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();copy(button.dataset.copy,button.dataset.copyLabel);}));
  $$("[data-open-row]").forEach(row=>row.addEventListener("click",()=>openDrawer(Number(row.dataset.openRow))));
  $$("[data-open]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();openDrawer(Number(button.dataset.open));}));
}

function renderEvents() {
  const filter=$("#event-filter").value;
  const events=(store.data.events||[]).filter(event=>!filter || event.channel===filter || (filter==="SYSTEM"&&!["EMAIL","WHATSAPP"].includes(event.channel))).slice(0,100);
  $("#activity-list").innerHTML=events.length ? events.map(event=>{
    const channel=event.channel||"SYSTEM";
    const icon=channel==="EMAIL"?"@":channel==="WHATSAPP"?"WA":"•";
    const klass=channel==="WHATSAPP"?"wa":channel==="EMAIL"?"":"system";
    return `<article class="activity-item"><span class="activity-icon ${klass}">${icon}</span><div><strong>${esc(event.eventType||event.status||"Evento")}</strong><p>${esc([event.empresa,event.recipient,event.detail].filter(Boolean).join(" · ")||"Actividad del sistema")}</p></div><time>${esc(relativeDate(event.timestamp))}</time></article>`;
  }).join("") : '<div class="empty-state">Todavía no hay eventos para este filtro.</div>';
}

function renderQueue() {
  const queue=(store.data.queue||[]).slice().sort((a,b)=>String(b.sentAt||b.scheduledAt||"").localeCompare(String(a.sentAt||a.scheduledAt||"")));
  $("#queue-count").textContent=`${queue.length} mensajes importados`;
  $("#queue-list").innerHTML=queue.length ? queue.map(item=>{
    const channel=item.channel||"SYSTEM";
    const icon=channel==="EMAIL"?"@":channel==="WHATSAPP"?"WA":"•";
    const klass=channel==="WHATSAPP"?"wa":channel==="EMAIL"?"":"system";
    const moment=item.sentAt||item.scheduledAt;
    return `<article class="activity-item"><span class="activity-icon ${klass}">${icon}</span><div><strong>${esc(item.empresa||item.recipient||"Mensaje")}</strong><p>${esc([item.status,item.recipient,item.outcome,item.nextAction].filter(Boolean).join(" · "))}</p></div><time>${esc(moment?relativeDate(moment):"sin fecha")}</time></article>`;
  }).join("") : '<div class="empty-state">Outreach_Queue todavía no tiene registros.</div>';
}

function renderChannels() {
  const channels=store.data.channels||{};
  $("#channel-grid").innerHTML=["email","whatsapp"].map(key=>{
    const channel=channels[key]||{};
    const ready=channel.canSend===true;
    const title=key==="email"?"Email":"WhatsApp";
    const label=ready?"Listo":channel.connected?"Conectado · pausado":"Requiere conexión";
    return `<article class="channel-card"><div class="channel-top"><span class="channel-icon ${key==="whatsapp"?"wa":""}">${key==="email"?"@":"WA"}</span><span class="status ${ready?"status-ready":"status-review"}">${label}</span></div><h3>${title}</h3><p>${esc(channel.account||"Sin cuenta verificada")}</p><div class="channel-details"><div><span>Proveedor</span><strong>${esc(channel.provider||"Pendiente")}</strong></div><div><span>Modo</span><strong>${ready?"Envío con confirmación":"Bloqueado seguro"}</strong></div></div>${ready?"":`<div class="blocker">${esc(channel.detail||"Falta configurar el adaptador del canal.")}</div>`}</article>`;
  }).join("");
}

function renderSync() {
  const sync=store.data.sync||{};
  const live=sync.status==="LIVE";
  $("#sync-dot").className=`pulse ${live?"is-live":sync.status==="ERROR"?"is-error":""}`;
  $("#sync-label").textContent=live?"Sheets conectado":sync.status==="SNAPSHOT"?"Datos del Sheet":"Conexión pendiente";
  $("#sync-detail").textContent=sync.detail||"Snapshot local de la fuente comercial.";
  $("#last-sync").textContent=relativeDate(sync.fetchedAt);
}

function renderAll() {
  renderMetrics();
  populateRubroFilter();
  applyFilters(false);
  renderEvents();
  renderQueue();
  renderChannels();
  renderSync();
}

async function loadData(silent=false) {
  if(store.loading) return;
  store.loading=true;
  if(!silent) $("#refresh-button").textContent="…";
  try {
    const response=await fetch("/api/dashboard",{cache:"no-store"});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||"No se pudo cargar el dashboard");
    store.data=payload;
    renderAll();
  } catch(error) {
    toast(error.message||"No se pudo conectar con el servidor local.",true);
    $("#sync-dot").className="pulse is-error";
    $("#sync-label").textContent="Dashboard desconectado";
  } finally {
    store.loading=false;
    $("#refresh-button").textContent="↻";
  }
}

function openDrawer(rowNumber) {
  const prospect=store.data.prospects.find(row=>row.rowNumber===rowNumber);
  if(!prospect) return;
  store.selected=prospect;
  $("#drawer-rubro").textContent=prospect.rubro||"Sin rubro";
  $("#drawer-company").textContent=prospect.empresa||"Sin nombre";
  $("#drawer-location").textContent=prospect.ubicacion||"Sin ubicación";
  $("#drawer-rating").textContent=prospect.rating?`★ ${prospect.rating}`:"Sin rating";
  $("#drawer-reviews").textContent=prospect.reviewsAnalyzed||"Cobertura pendiente";
  $("#drawer-analysis").textContent=prospect.analysis||"Análisis pendiente.";
  $("#drawer-problems").textContent=prospect.problems||"No se registraron problemas.";
  $("#drawer-contacts").innerHTML=[
    {label:"Email",value:prospect.email,copy:prospect.email},{label:"WhatsApp",value:prospect.whatsapp,copy:waCopyValue(prospect)}
  ].map(item=>`<article class="contact-card"><div><span>${item.label}</span><strong>${esc(item.value||"No disponible")}</strong></div>${item.value?`<button data-drawer-copy="${esc(item.copy)}" data-label="${item.label}">Copiar</button>`:""}</article>`).join("");
  $$("[data-drawer-copy]").forEach(button=>button.addEventListener("click",()=>copy(button.dataset.drawerCopy,button.dataset.label)));
  $("#drawer-web").disabled=!prospect.web;
  store.messageChannel=prospect.email?"EMAIL":"WHATSAPP";
  renderMessagePreview();
  $("#drawer").classList.add("is-open");
  $("#drawer").setAttribute("aria-hidden","false");
  $("#scrim").classList.add("is-open");
}

function closeDrawer() {
  $("#drawer").classList.remove("is-open");
  $("#drawer").setAttribute("aria-hidden","true");
  $("#scrim").classList.remove("is-open");
}

function renderMessagePreview() {
  const prospect=store.selected;
  if(!prospect) return;
  $$("[data-message-tab]").forEach(button=>button.classList.toggle("is-active",button.dataset.messageTab===store.messageChannel));
  $("#message-channel").textContent=store.messageChannel;
  $("#message-preview").textContent=store.messageChannel==="EMAIL" ? (prospect.emailMessage||"Borrador de email pendiente.") : (prospect.whatsappMessage||"Borrador de WhatsApp pendiente.");
  const recipient=store.messageChannel==="EMAIL"?prospect.email:prospect.whatsapp;
  const blocker=sendBlocker(prospect,store.messageChannel);
  $("#open-send").disabled=!recipient;
  $("#open-send").textContent=!recipient?"Canal no disponible":blocker?"Ver requisitos de envío":`Revisar y enviar ${store.messageChannel==="EMAIL"?"email":"WhatsApp"}`;
  $("#open-send").classList.toggle("button-primary",!blocker&&Boolean(recipient));
  $("#open-send").classList.toggle("button-secondary",Boolean(blocker)||!recipient);
  $("#drawer-send-status").textContent=blocker?(sendErrors[blocker]||blocker):"Listo para una confirmación final antes del envío.";
  $("#drawer-send-status").classList.toggle("is-ready",!blocker);
}

function openSendDialog() {
  const prospect=store.selected;
  if(!prospect) return;
  const isWa=store.messageChannel==="WHATSAPP";
  const recipient=isWa?waCopyValue(prospect):prospect.email;
  const message=isWa?prospect.whatsappMessage:prospect.emailMessage;
  if(!recipient) return toast("Este prospecto no tiene un contacto verificable para el canal.",true);
  $("#send-title").textContent=`Enviar ${isWa?"WhatsApp":"email"} a ${prospect.empresa}`;
  $("#send-recipient").textContent=recipient;
  $("#send-message").value=message||"";
  $("#wa-optin").classList.toggle("is-visible",isWa);
  if(isWa) {
    const optIn=prospect.whatsappOptIn||{};
    $("#optin-status").textContent=optIn.eligible?`Opt-in inbound verificado · ${relativeDate(optIn.recordedAt)}`:"Sin opt-in inbound durable y reconciliado";
    $("#optin-status").classList.toggle("is-verified",optIn.eligible===true);
  }
  const blocker=sendBlocker(prospect,store.messageChannel);
  $("#send-error").textContent=blocker?(sendErrors[blocker]||blocker):"";
  $("#send-error").classList.toggle("is-visible",Boolean(blocker));
  $("#confirm-send").disabled=Boolean(blocker);
  $("#confirm-send").textContent=blocker?"Envío bloqueado":"Confirmar envío";
  $("#send-dialog").showModal();
}

const sendErrors={
  EMAIL_PROVIDER_NOT_CONFIGURED:"Falta conectar el webhook exclusivo de Gmail/Brevo.",
  WHATSAPP_PROVIDER_NOT_CONFIGURED:"Falta cargar el token local de la línea WIS terminada en 5679.",
  WHATSAPP_PHONE_INVALID:"El número publicado no está en formato internacional verificable (+54…). Corregilo en el Sheet antes de enviar.",
  CHANNEL_BLOCKED:"El canal todavía está bloqueado por su verificación de seguridad.",
  INDEPENDENT_QA_REQUIRED:"Este mensaje todavía no tiene QA independiente aprobado.",
  BATCH_APPROVAL_REQUIRED:"Falta una aprobación de lote vigente que incluya este destinatario, canal y versión.",
  DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED:"Falta reconciliar la cola y el proveedor antes de habilitar el envío.",
  APPROVED_MESSAGE_HASH_REQUIRED:"La versión aprobada no tiene una huella verificable del mensaje.",
  APPROVAL_RECIPIENT_LIMIT_REACHED:"La aprobación ya consumió el número exacto de destinatarios autorizado.",
  DURABLE_OPTIN_REQUIRED:"WhatsApp exige un opt-in inbound durable y reconciliado; no puede cargarse manualmente desde este panel.",
  SERVICE_WINDOW_EXPIRED:"El opt-in quedó fuera de la ventana de 24 horas y no hay una plantilla aprobada seleccionada.",
  EMAIL_FIRST_REQUIRED:"Primero debe existir un email inicial enviado a este prospecto.",
  DAILY_LIMIT_REACHED:"El canal alcanzó su límite diario y quedó pausado.",
  MINIMUM_INTERVAL_NOT_REACHED:"Todavía no transcurrieron 15 minutos desde el último envío del canal.",
  EMAIL_WINDOW_CLOSED:"Los emails sólo se envían de 09:30 a 17:30 de Buenos Aires.",
  PROSPECT_STOPPED:"El prospecto está detenido por respuesta, baja, reunión, rebote duro o resultado incierto.",
  SIMULTANEOUS_CHANNEL_BLOCKED:"Hay una operación activa en el otro canal para este prospecto.",
  DUPLICATE_IDEMPOTENCY_KEY:"Este mismo mensaje ya fue procesado. No se duplicó.",
  SEND_IN_PROGRESS:"Ya hay una operación de este canal en curso. Esperá su resultado antes de reintentar.",
  PROVIDER_REJECTED:"El proveedor rechazó el envío. Revisá la salud del canal.",
  EMAIL_SIGNATURE_NOT_APPROVED:"Falta aprobar y cargar la firma HTML WIS sin Gravatar.",
  RECIPIENT_MISSING:"Este prospecto no tiene un destinatario verificable para el canal.",
  PROSPECT_NOT_FOUND:"El prospecto ya no existe en la última sincronización.",
  MESSAGE_CHANGED:"El borrador cambió desde la última lectura. Actualizá antes de enviar."
};

async function sendMessage(event) {
  event.preventDefault();
  const prospect=store.selected;
  const isWa=store.messageChannel==="WHATSAPP";
  const errorNode=$("#send-error");
  errorNode.classList.remove("is-visible");
  const button=$("#confirm-send");
  button.disabled=true;
  button.textContent="Enviando…";
  try {
    const response=await fetch("/api/outreach/send",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      rowNumber:prospect.rowNumber,
      channel:store.messageChannel,
      message:$("#send-message").value,
      confirmed:true
    })});
    const payload=await response.json();
    if(!response.ok) throw new Error(sendErrors[payload.error]||payload.detail||payload.error||"No se pudo enviar");
    $("#send-dialog").close();
    toast(`${isWa?"WhatsApp":"Email"} enviado y registrado sin duplicados.`);
    await loadData(true);
  } catch(error) {
    errorNode.textContent=error.message;
    errorNode.classList.add("is-visible");
  } finally {
    const blocker=sendBlocker(prospect,store.messageChannel);
    button.disabled=Boolean(blocker);
    button.textContent=blocker?"Envío bloqueado":"Confirmar envío";
  }
}

async function requestSync() {
  $("#sync-button").textContent="Sincronizando…";
  try {
    const response=await fetch("/api/sync",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.detail||payload.error);
    toast("Datos actualizados desde Google Sheets.");
    await loadData(true);
  } catch(error) {
    toast(error.message==="SHEETS_PROXY_NOT_CONFIGURED"?"La vista ya contiene el último snapshot real. Falta conectar el refresco automático de Sheets.":error.message,true);
  } finally { $("#sync-button").textContent="Sincronizar ahora"; }
}

async function enqueueResearch() {
  try {
    const response=await fetch("/api/actions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"CONTINUE_RESEARCH",scope:"NEXT_PENDING_BATCH",idempotencyKey:`CONTINUE_RESEARCH:${new Date().toISOString().slice(0,10)}`})});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error);
    toast(payload.deduplicated?"La tarea de hoy ya estaba registrada.":"Próximo lote de research registrado.");
  } catch(error) { toast(error.message||"No se pudo registrar la tarea.",true); }
}

function showResearchResult(message,isError=false) {
  const node=$("#research-result");
  node.textContent=message;
  node.classList.add("is-visible");
  node.classList.toggle("is-error",isError);
}

async function createResearchRequest(input,button) {
  const original=button.textContent;
  button.disabled=true;
  button.classList.add("is-loading");
  button.textContent="Registrando…";
  try {
    const response=await fetch("/api/research/request",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||"No se pudo crear la tarea");
    const request=payload.request||{};
    showResearchResult(`${payload.deduplicated?"Este pedido ya estaba registrado":"Tarea creada"}: ${request.quantity} ${request.businessType} · ${request.industry} · ${request.location}. Quedó pendiente para el ejecutor de research.`);
    toast(payload.deduplicated?"El pedido ya existía en la cola.":"Pedido agregado a Task_Commands.");
  } catch(error) {
    const message=error.message==="RESEARCH_INDUSTRY_REQUIRED"?"Indicá el rubro que querés investigar.":error.message;
    showResearchResult(message||"No se pudo registrar el pedido.",true);
    toast(message||"No se pudo registrar el pedido.",true);
  } finally {
    button.disabled=false;
    button.classList.remove("is-loading");
    button.textContent=original;
  }
}

async function submitResearchChat(event) {
  event.preventDefault();
  const prompt=$("#research-prompt").value.trim();
  if(!prompt) return showResearchResult("Escribí qué empresas querés buscar.",true);
  await createResearchRequest({prompt},$("#research-chat-submit"));
}

async function submitResearchForm(event) {
  event.preventDefault();
  await createResearchRequest({
    quantity:Number($("#research-quantity").value),
    businessType:$("#research-business-type").value,
    industry:$("#research-industry").value,
    location:$("#research-location").value,
    reviews:$("#research-reviews").value,
    contact:$("#research-contact").value,
    objective:$("#research-objective").value
  },$("#research-form-submit"));
}

async function prepareApolloPilot() {
  const button=$("#apollo-pilot");
  const original=button.textContent;
  button.disabled=true;
  button.textContent="Registrando…";
  try {
    const response=await fetch("/api/actions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      action:"EVALUATE_APOLLO",
      scope:"PILOT_50_EXISTING_PROSPECTS",
      idempotencyKey:`EVALUATE_APOLLO:PILOT_50:${new Date().toISOString().slice(0,10)}`
    })});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||"No se pudo preparar el piloto");
    $("#apollo-status").textContent=payload.deduplicated?"Ya registrado":"En cola";
    toast(payload.deduplicated?"El piloto Apollo ya estaba registrado.":"Piloto Apollo agregado a la cola, sin realizar envíos.");
  } catch(error) { toast(error.message||"No se pudo preparar el piloto.",true); }
  finally { button.disabled=false;button.textContent=original; }
}

function switchView(id) {
  $$(".view").forEach(view=>view.classList.toggle("is-active",view.id===id));
  $$("[data-view]").forEach(button=>button.classList.toggle("is-active",button.dataset.view===id));
  $("#page-title").textContent={prospects:"Prospectos",research:"Nuevo research",activity:"Actividad",channels:"Canales",apollo:"Apollo"}[id]||"Prospectos";
  history.replaceState(null,"",`#${id}`);
}

$$("[data-view]").forEach(button=>button.addEventListener("click",()=>switchView(button.dataset.view)));
["#search","#filter-rubro","#filter-contact","#filter-status"].forEach(selector=>$(selector).addEventListener(selector==="#search"?"input":"change",()=>applyFilters()));
$("#clear-filters").addEventListener("click",()=>{$("#search").value="";$("#filter-rubro").value="";$("#filter-contact").value="";$("#filter-status").value="";applyFilters();});
$("#page-prev").addEventListener("click",()=>{store.page--;renderTable();});
$("#page-next").addEventListener("click",()=>{store.page++;renderTable();});
$("#event-filter").addEventListener("change",renderEvents);
$("#refresh-button").addEventListener("click",()=>loadData());
$("#sync-button").addEventListener("click",requestSync);
$("#hero-sync").addEventListener("click",requestSync);
$("#continue-research").addEventListener("click",enqueueResearch);
$("#research-chat-form").addEventListener("submit",submitResearchChat);
$("#research-form").addEventListener("submit",submitResearchForm);
$("#apollo-pilot").addEventListener("click",prepareApolloPilot);
$$("[data-close]").forEach(node=>node.addEventListener("click",closeDrawer));
$$("[data-modal-close]").forEach(node=>node.addEventListener("click",()=>$("#send-dialog").close()));
$$("[data-message-tab]").forEach(button=>button.addEventListener("click",()=>{store.messageChannel=button.dataset.messageTab;renderMessagePreview();}));
$("#copy-message").addEventListener("click",()=>copy($("#message-preview").textContent,"Mensaje"));
$("#copy-recipient").addEventListener("click",()=>copy($("#send-recipient").textContent,"Destinatario"));
$("#drawer-web").addEventListener("click",()=>store.selected?.web&&window.open(store.selected.web,"_blank","noopener"));
$("#open-send").addEventListener("click",openSendDialog);
$("#send-form").addEventListener("submit",sendMessage);
document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();$("#search").focus();}if(event.key==="Escape")closeDrawer();});

const initialView=["prospects","research","activity","channels","apollo"].includes(location.hash.slice(1))?location.hash.slice(1):"prospects";
switchView(initialView);
loadData();
setInterval(()=>loadData(true),30_000);
