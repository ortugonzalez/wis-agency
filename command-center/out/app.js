const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const PAGE_SIZE = 18;

const store = {
  data: { prospects:[], events:[], queue:[], stats:{}, channels:{}, sync:{}, research:{requests:[],summary:{}}, automation:{status:"INACTIVE",config:{},executor:{},lanes:[],recentCommands:[],counters:{},gates:{}}, costs:{summary:{},unitEconomics:{},tokens:{},records:[],recommendations:[]} },
  filtered: [],
  page: 1,
  selected: null,
  messageChannel: "EMAIL",
  loading: false,
  whatsapp: {loaded:false,loading:false,status:null,conversations:[],selected:null,messages:[],filter:"all"}
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
  if (prospect.phase==="contacts" && prospect.empresa && (prospect.email || prospect.whatsapp)) return "contacts-ready";
  const coverage=/^\s*\d+\s*\/\s*\d+\s*$/.test(prospect.reviewsAnalyzed || "");
  if (coverage && prospect.analysis && prospect.problems && (prospect.emailMessage || prospect.whatsappMessage)) return "ready";
  return "needs-work";
}

function statusBadge(prospect) {
  const status=prospectStatus(prospect);
  if(status==="sent") return '<span class="status status-sent">Contactado</span>';
  if(status==="contacts-ready") return '<span class="status status-ready">Contacto validado</span>';
  if(status==="ready") return '<span class="status status-ready">Listo para revisar</span>';
  return '<span class="status status-review">Requiere trabajo</span>';
}

function metric(label,value,note,tone="") {
  return `<article class="metric ${tone}"><span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
}

function renderMetrics() {
  const s=store.data.stats || {};
  const sources={...(s.prospectsBySheet||{})};
  sources.Hoteles_Argentina_300=(sources.Hoteles_Argentina_300||0)+(sources.Hoteles_LATAM_500||0);
  $("#metrics").innerHTML=[
    metric("Prospectos",s.prospects ?? store.data.prospects.length,`Distribuidoras ${sources.Distribuidoras_300||0} · Hoteles ${sources.Hoteles_Argentina_300||0}`),
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
  const campaign=$("#filter-campaign").value;
  const rubro=$("#filter-rubro").value;
  const contact=$("#filter-contact").value;
  const status=$("#filter-status").value;
  store.filtered=store.data.prospects.filter(row=>{
    const haystack=normalize([row.empresa,row.rubro,row.ubicacion,row.email,row.whatsapp,row.problems,row.analysis].join(" "));
    const contactMatch=!contact || (contact==="email"&&row.email) || (contact==="whatsapp"&&row.whatsapp) ||
      (contact==="both"&&row.email&&row.whatsapp) || (contact==="missing"&&(!row.email||!row.whatsapp));
    return (!query||haystack.includes(query)) && (!campaign||row.campaignId===campaign) && (!rubro||row.rubro===rubro) && contactMatch && (!status||prospectStatus(row)===status);
  });
  renderTable();
}

function waCopyValue(prospect) {
  return prospect.whatsappE164 || String(prospect.whatsapp||"").split("(")[0].trim();
}

function sendBlocker(prospect,channelName) {
  if(prospect.phase==="contacts") return "HOTEL_CONTACTS_ONLY";
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
    <tr data-open-row="${esc(row.prospectId)}">
      <td><div class="company-cell"><span class="company-avatar">${esc((row.empresa||"?").slice(0,1).toUpperCase())}</span><div><strong>${esc(row.empresa||"Sin nombre")}</strong><small>${row.campaignId==="hoteles-latam-500"?"Hoteles LATAM":row.phase==="contacts"?"Hoteles Argentina":`Fila ${esc(row.rowNumber)}`}</small></div></div></td>
      <td><div class="rubric-cell"><strong>${esc(row.rubro||"Sin rubro")}</strong><span>${esc(row.ubicacion||"Sin ubicación")}</span></div></td>
      <td><div class="contact-stack">${contactChip("email",row.email,row.rowNumber)}${contactChip("whatsapp",row.whatsapp,row.rowNumber,waCopyValue(row))}${!row.email&&!row.whatsapp?'<span>Sin contacto verificable</span>':""}</div></td>
      <td><div class="problem-cell"><p>${esc(row.phase==="contacts"?"Contacto validado · análisis reservado para la fase 2":row.problems||row.analysis||"Análisis pendiente")}</p></div></td>
      <td>${statusBadge(row)}</td>
      <td><div class="row-actions">${row.phase==="contacts"?"":`<button class="write-button" data-compose="${esc(row.prospectId)}" data-channel="${row.email?"EMAIL":"WHATSAPP"}" ${!row.email&&!row.whatsapp?"disabled":""}>Escribir</button>`}<button class="row-button" data-open="${esc(row.prospectId)}" aria-label="Ver detalles de ${esc(row.empresa)}">Ver</button></div></td>
    </tr>`).join("") : '<tr><td colspan="6" class="empty-state">No hay prospectos que coincidan con estos filtros.</td></tr>';
  $$("[data-copy]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();copy(button.dataset.copy,button.dataset.copyLabel);}));
  $$("[data-open-row]").forEach(row=>row.addEventListener("click",()=>openDrawer(row.dataset.openRow)));
  $$("[data-open]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();openDrawer(button.dataset.open);}));
  $$("[data-compose]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();openComposer(button.dataset.compose,button.dataset.channel);}));
}

const usd=value=>Number(value||0).toLocaleString("es-AR",{style:"currency",currency:"USD",minimumFractionDigits:Number(value||0)<1?4:2,maximumFractionDigits:Number(value||0)<1?4:2});
const compact=value=>Number(value||0).toLocaleString("es-AR",{notation:"compact",maximumFractionDigits:1});
const unitCost=value=>value===null||value===undefined?"—":usd(value);

function costBarRows(rows=[],empty="Todavía no hay consumos medidos") {
  const max=Math.max(0,...rows.map(row=>Number(row.costUsd||0)));
  if(!rows.length) return `<div class="cost-empty">${esc(empty)}</div>`;
  return rows.map(row=>`<div class="cost-bar-row"><div><strong>${esc(String(row.key||"Otro").replaceAll("_"," "))}</strong><span>${row.records} registro${row.records===1?"":"s"}</span></div><div class="cost-bar-track"><i style="width:${max?Math.max(4,row.costUsd/max*100):0}%"></i></div><b>${esc(usd(row.costUsd))}</b></div>`).join("");
}

function renderCosts() {
  const costs=store.data.costs||{};
  const summary=costs.summary||{};
  const economics=costs.unitEconomics||{};
  const settings=costs.settings||{};
  const tokens=costs.tokens||{};
  const measured=costs.sources?.measured===true;
  $("#cost-source-badge").textContent=measured?`${costs.sources.ledgerRows} consumos medidos`:"Listo para medir";
  $("#cost-source-badge").classList.toggle("is-live",measured);
  $("#cost-metrics").innerHTML=[
    metric("Gasto del mes",usd(summary.spendMtd),`Variable ${usd(summary.variableMtd)} + fijo devengado`),
    metric("Proyección mensual",usd(summary.projectedMonth),`${summary.projectedBudgetPct||0}% del presupuesto`,summary.alertLevel==="OK"?"blue":"amber"),
    metric("Tokens de entrada",compact(tokens.input),`${tokens.cacheRate||0}% recuperado desde caché`),
    metric("Búsquedas web",compact(tokens.webSearches),"Llamadas registradas","red")
  ].join("");
  const pct=Math.max(0,Number(summary.budgetUsedPct||0));
  $("#budget-percent").textContent=`${Math.round(pct)}%`;
  $("#budget-spend").textContent=usd(summary.spendMtd);
  $("#budget-projection").textContent=`Proyección: ${usd(summary.projectedMonth)} de ${usd(settings.monthlyBudgetUsd)}`;
  $("#budget-progress").style.width=`${Math.min(100,pct)}%`;
  $("#budget-ring").style.setProperty("--budget-angle",`${Math.min(100,pct)*3.6}deg`);
  $("#cost-budget").value=settings.monthlyBudgetUsd??150;
  $("#cost-fixed").value=settings.fixedMonthlyUsd??0;
  const alert=$("#cost-alert");
  const levels={OK:["✓","Presupuesto bajo control","La proyección mensual está dentro del límite configurado."],LOW:["i","Atención temprana","La proyección ya supera el 50% del presupuesto."],MEDIUM:["!","Revisá el ritmo de gasto","La proyección supera el 75% del presupuesto mensual."],HIGH:["!","Presupuesto casi agotado","La proyección supera el 90%. Conviene pausar o cambiar de modelo."],CRITICAL:["×","Proyección por encima del límite","Antes de escalar, reducí llamadas o aumentá el presupuesto aprobado."]};
  const copy=levels[summary.alertLevel]||levels.OK;
  alert.className=`cost-alert is-${String(summary.alertLevel||"OK").toLowerCase()}`;
  alert.innerHTML=`<span>${copy[0]}</span><div><strong>${copy[1]}</strong><p>${copy[2]}</p></div>`;
  $("#nav-cost-alert").textContent=summary.alertLevel==="OK"?"OK":`${Math.round(summary.projectedBudgetPct||0)}%`;
  $("#unit-economics").innerHTML=[
    ["Por prospecto",economics.costPerProspect,`${economics.measuredProspects||0} medidos`],
    ["Por prospecto listo",economics.costPerQualified,`${economics.qualified||0} listos`],
    ["Por respuesta",economics.costPerReply,`${economics.replies||0} respuestas`],
    ["Por reunión",economics.costPerMeeting,`${economics.meetings||0} reuniones`]
  ].map(([label,value,note])=>`<article><span>${esc(label)}</span><strong>${esc(unitCost(value))}</strong><small>${esc(note)}</small></article>`).join("");
  $("#cost-provider-list").innerHTML=costBarRows(costs.byProvider);
  $("#cost-stage-list").innerHTML=costBarRows(costs.byStage);
  $("#pricing-version").textContent=`Tarifas ${costs.pricingVersion||"—"}`;
  $("#cost-recommendations").innerHTML=(costs.recommendations||[]).map(item=>`<article class="recommendation is-${String(item.level||"info").toLowerCase()}"><span>${item.level==="HIGH"?"!":item.level==="MEDIUM"?"↗":"i"}</span><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div></article>`).join("")||'<div class="cost-empty">No hay recomendaciones pendientes.</div>';
  $("#cost-ledger").innerHTML=(costs.records||[]).slice(0,12).map(row=>`<article><span class="ledger-provider">${esc(row.provider)}</span><div><strong>${esc(row.empresa||row.stage||row.operationId||"Operación")}</strong><p>${esc([row.service,row.stage,row.model,row.freeUnitsApplied?`${row.freeUnitsApplied} dentro de cuota`:""].filter(Boolean).join(" · "))}</p></div><b>${esc(usd(row.effectiveCostUsd??row.calculatedCostUsd))}</b><time>${esc(relativeDate(row.timestamp))}</time></article>`).join("")||'<div class="cost-empty">El próximo research, borrador o envío aparecerá aquí automáticamente.</div>';
}

let simulatorTimer;
async function updateCostSimulator() {
  clearTimeout(simulatorTimer);
  simulatorTimer=setTimeout(async()=>{
    try {
      const historical=$("#sim-maps-profile").value==="historical";
      const response=await fetch("/api/costs/estimate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prospects:Number($("#sim-prospects").value),model:$("#sim-model").value,pricingTier:$("#sim-tier").value,inputTokensPerProspect:historical?0:15000,outputTokensPerProspect:historical?0:2500,webSearchesPerProspect:Number($("#sim-web").value),placesTextService:$("#sim-places-search-service").value,placesTextCalls:Number($("#sim-places-search-calls").value),placeDetailsService:$("#sim-place-details-service").value,placeDetailsCalls:Number($("#sim-place-details-calls").value),emailsPerProspect:Number($("#sim-email").value),fixedMonthlyUsd:historical?0:Number($("#cost-fixed").value)})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error);
      const result=payload.estimate;
      $("#sim-total").textContent=usd(result.totalUsd);
      $("#sim-per-prospect").textContent=usd(result.costPerProspect);
      const labels={ai:"IA",webSearch:"Búsquedas",places:"Google Maps",email:"Emails",fixed:"Costos fijos"};
      $("#sim-breakdown").innerHTML=Object.entries(result.breakdown).map(([key,value])=>`<span>${labels[key]||key}: <b>${esc(usd(value))}</b></span>`).join("");
      const usage=result.placesUsage||{};
      $("#sim-maps-detail").innerHTML=[usage.textSearch,usage.placeDetails].filter(Boolean).map(item=>`<article><div><strong>${esc(item.label)}</strong><span>${compact(item.units)} consultas · ${item.freeCap===null?"sin cargo":`${compact(item.freeApplied)} incluidas / ${compact(item.billableUnits)} cobradas`}</span></div><b>${esc(usd(item.costUsd))}</b></article>`).join("");
    } catch(error) { $("#sim-breakdown").textContent=error.message||"No se pudo calcular."; }
  },180);
}

let applyingMapsProfile=false;
function applyMapsProfile() {
  applyingMapsProfile=true;
  const profile=$("#sim-maps-profile").value;
  const prospects=Math.max(1,Number($("#sim-prospects").value)||300);
  if(profile==="historical") {
    $("#sim-prospects").value="300";
    $("#sim-places-search-service").value="places-text-search-enterprise";
    $("#sim-places-search-calls").value="1921";
    $("#sim-place-details-service").value="place-details-enterprise-atmosphere";
    $("#sim-place-details-calls").value="0";
    $("#sim-web").value="0";
    $("#sim-email").value="0";
  } else if(profile==="optimized") {
    $("#sim-places-search-service").value="places-text-search-pro";
    $("#sim-places-search-calls").value=String(Math.ceil(prospects/5));
    $("#sim-place-details-service").value="place-details-enterprise-atmosphere";
    $("#sim-place-details-calls").value=String(prospects);
    $("#sim-email").value="1";
  }
  applyingMapsProfile=false;
  updateCostSimulator();
}

async function saveCostSettings(event) {
  event.preventDefault();
  const button=event.currentTarget.querySelector("button");
  button.disabled=true;button.textContent="Guardando…";
  try {
    const response=await fetch("/api/costs/settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({monthlyBudgetUsd:Number($("#cost-budget").value),fixedMonthlyUsd:Number($("#cost-fixed").value)})});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error);
    toast("Presupuesto guardado en Google Sheets.");
    await loadData(true);
  } catch(error) { toast(error.message||"No se pudo guardar el presupuesto.",true); }
  finally { button.disabled=false;button.textContent="Guardar límites"; }
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

function waName(conversation) {
  return conversation.display_name||conversation.title||conversation.contact_name||conversation.phone_e164||"Contacto de WhatsApp";
}

function waInitial(conversation) {
  return waName(conversation).replace(/[^\p{L}\p{N}]/gu,"").slice(0,1).toUpperCase()||"W";
}

function waMoment(value,withDate=false) {
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return "";
  const sameDay=date.toDateString()===new Date().toDateString();
  return sameDay&&!withDate?date.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}):date.toLocaleDateString("es-AR",{day:"2-digit",month:"short"});
}

function waConversationMatchesFilter(conversation) {
  const group=String(conversation.wa_chat_id||"").endsWith("@g.us");
  return store.whatsapp.filter==="all"||(store.whatsapp.filter==="group"&&group)||(store.whatsapp.filter==="direct"&&!group);
}

function renderWhatsappStatus() {
  const status=store.whatsapp.status||{};
  const card=$("#wa-connection-card");
  card.classList.toggle("is-online",status.connected===true&&status.identityVerified===true);
  card.classList.toggle("is-offline",status.configured===false||status.error);
  $("#wa-connection-label").textContent=status.connected&&status.identityVerified?`Línea ${status.account||"•••• 5679"} conectada`:status.configured?"Conexión temporalmente no disponible":"Falta conectar Baileys";
  $("#wa-connection-detail").textContent=status.connected?(status.outboundEnabled?"Recepción y salida habilitadas":"Recepción en vivo · salida protegida"):status.error?"No se pudo consultar el servicio":"Esperando credencial del servicio";
}

function renderWhatsappConversations() {
  const rows=store.whatsapp.conversations.filter(waConversationMatchesFilter);
  $("#wa-total").textContent=`${store.whatsapp.conversations.length} conversaciones`;
  $("#nav-wa-count").textContent=store.whatsapp.conversations.length||"—";
  $("#wa-conversation-list").innerHTML=rows.length?rows.map(conversation=>`
    <button class="wa-conversation ${store.whatsapp.selected?.id===conversation.id?"is-active":""}" data-wa-conversation="${esc(conversation.id)}">
      <span class="wa-avatar">${esc(waInitial(conversation))}</span>
      <span class="wa-conversation-copy"><strong>${esc(waName(conversation))}</strong><span>${esc(conversation.last_message_preview||"Sin mensajes de texto")}</span></span>
      <time>${esc(waMoment(conversation.last_message_at))}</time>
    </button>`).join(""):'<div class="wa-list-empty">No hay conversaciones que coincidan con este filtro.</div>';
  $$('[data-wa-conversation]').forEach(button=>button.addEventListener("click",()=>openWhatsappConversation(button.dataset.waConversation)));
}

function renderWhatsappMessages() {
  const conversation=store.whatsapp.selected;
  if(!conversation) return;
  const messages=store.whatsapp.messages;
  let lastDay="";
  $("#wa-message-stage").innerHTML=messages.length?messages.map(message=>{
    const date=new Date(message.created_at);
    const day=Number.isFinite(date.getTime())?date.toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"}):"";
    const separator=day&&day!==lastDay?`<span class="wa-day">${esc(day)}</span>`:"";
    lastDay=day||lastDay;
    const outbound=message.direction==="out";
    return `${separator}<div class="wa-bubble-row ${outbound?"is-out":""}"><article class="wa-bubble"><p>${esc(message.body||`[${message.type||"Mensaje"}]`)}</p><footer><span>${esc(waMoment(message.created_at))}</span>${outbound?`<span class="wa-ticks">${/read|delivered/i.test(message.delivery_status||"")?"✓✓":"✓"}</span>`:""}</footer></article></div>`;
  }).join(""):'<div class="wa-list-empty">Todavía no hay mensajes guardados en esta conversación.</div>';
  $("#wa-message-stage").scrollTop=$("#wa-message-stage").scrollHeight;
}

function whatsappMatchedProspect(conversation) {
  const digits=String(conversation?.phone_e164||conversation?.wa_chat_id||"").replace(/\D/g,"");
  if(!digits) return null;
  return store.data.prospects.find(prospect=>String(prospect.whatsappE164||prospect.whatsapp||"").replace(/\D/g,"")===digits)||null;
}

function configureWhatsappComposer() {
  const prospect=whatsappMatchedProspect(store.whatsapp.selected);
  const button=$("#wa-send");
  const reply=$("#wa-reply");
  const hint=$("#wa-send-hint");
  if(!prospect) {
    button.disabled=true;
    reply.value="";
    reply.disabled=true;
    hint.textContent="Este chat todavía no está vinculado con un prospecto del pipeline.";
    return;
  }
  const blocker=sendBlocker(prospect,"WHATSAPP");
  reply.value=prospect.whatsappMessage||"";
  reply.disabled=Boolean(blocker);
  button.disabled=Boolean(blocker)||!reply.value;
  hint.textContent=blocker?(sendErrors[blocker]||blocker):"Mensaje aprobado. Al continuar verás la confirmación final antes del envío.";
}

async function openWhatsappConversation(id) {
  const conversation=store.whatsapp.conversations.find(row=>row.id===id);
  if(!conversation) return;
  store.whatsapp.selected=conversation;
  renderWhatsappConversations();
  $("#wa-chat-empty").hidden=true;
  $("#wa-chat").hidden=false;
  $(".wa-shell").classList.add("is-chat-open");
  $("#wa-chat-avatar").textContent=waInitial(conversation);
  $("#wa-chat-name").textContent=waName(conversation);
  $("#wa-chat-phone").textContent=conversation.phone_e164||"Identificador de WhatsApp";
  $("#wa-chat-state").textContent="Cargando historial…";
  $("#wa-message-stage").innerHTML='<div class="wa-loading">Cargando mensajes…</div>';
  configureWhatsappComposer();
  try {
    const response=await fetch(`/api/whatsapp/messages?conversationId=${encodeURIComponent(id)}&limit=100`,{cache:"no-store"});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||"No se pudo cargar el historial");
    store.whatsapp.messages=Array.isArray(payload.data)?payload.data:[];
    $("#wa-chat-state").textContent=`${store.whatsapp.messages.length} mensajes visibles`;
    renderWhatsappMessages();
  } catch(error) {
    $("#wa-chat-state").textContent="Historial no disponible";
    $("#wa-message-stage").innerHTML=`<div class="wa-error">${esc(error.message||"No se pudo cargar el historial")}</div>`;
  }
}

async function loadWhatsapp(silent=false) {
  if(store.whatsapp.loading) return;
  store.whatsapp.loading=true;
  if(!silent) $("#wa-conversation-list").innerHTML='<div class="wa-loading">Cargando conversaciones…</div>';
  try {
    const query=$("#wa-search").value.trim();
    const [statusResponse,conversationResponse]=await Promise.all([
      fetch("/api/whatsapp/status",{cache:"no-store"}),
      fetch(`/api/whatsapp/conversations?limit=100${query?`&q=${encodeURIComponent(query)}`:""}`,{cache:"no-store"})
    ]);
    const status=await statusResponse.json();
    const conversations=await conversationResponse.json();
    store.whatsapp.status=status;
    if(!conversationResponse.ok) throw new Error(conversations.error||"No se pudieron cargar las conversaciones");
    store.whatsapp.conversations=Array.isArray(conversations.data)?conversations.data:[];
    store.whatsapp.loaded=true;
    renderWhatsappStatus();
    renderWhatsappConversations();
  } catch(error) {
    store.whatsapp.status={configured:false,connected:false,error:error.message};
    renderWhatsappStatus();
    $("#wa-conversation-list").innerHTML=`<div class="wa-error">${esc(error.message||"WhatsApp no está disponible")}</div>`;
  } finally {
    store.whatsapp.loading=false;
  }
}

function openWhatsappSendConfirmation() {
  const prospect=whatsappMatchedProspect(store.whatsapp.selected);
  if(!prospect) return toast("Este chat todavía no está vinculado con un prospecto.",true);
  store.selected=prospect;
  store.messageChannel="WHATSAPP";
  openSendDialog();
  $("#send-message").value=$("#wa-reply").value;
}

function renderSync() {
  const sync=store.data.sync||{};
  const live=sync.status==="LIVE";
  $("#sync-dot").className=`pulse ${live?"is-live":sync.status==="ERROR"?"is-error":""}`;
  $("#sync-label").textContent=live?"Sheets conectado":sync.status==="SNAPSHOT"?"Datos del Sheet":"Conexión pendiente";
  $("#sync-detail").textContent=sync.detail||"Snapshot local de la fuente comercial.";
  $("#last-sync").textContent=relativeDate(sync.fetchedAt);
}

const researchStatusLabels={
  NEW:"Pendiente",
  PENDING:"Pendiente",
  READY:"Listo para iniciar",
  IN_PROGRESS:"Procesando",
  REVIEW:"En revisión",
  WAITING_APPROVAL:"Esperando aprobación",
  DONE:"Completado",
  BLOCKED:"Bloqueado",
  FAILED:"Con error",
  CANCELLED:"Cancelado"
};

function researchStatusClass(status) {
  if(status==="DONE") return "is-done";
  if(status==="IN_PROGRESS") return "is-running";
  if(["BLOCKED","FAILED","CANCELLED"].includes(status)) return "is-blocked";
  if(["REVIEW","WAITING_APPROVAL"].includes(status)) return "is-review";
  return "is-pending";
}

function researchRequestTitle(row) {
  const request=row.request||{};
  if(request.batchName) return request.batchName;
  if(row.action==="CONTINUE_RESEARCH") return "Continuar próximo lote pendiente";
  return `${request.quantity||"—"} ${request.businessType||"empresas"} · ${request.industry||row.scope||"Research"}`;
}

function renderResearch() {
  const research=store.data.research||{requests:[],summary:{},executor:{}};
  const summary=research.summary||{};
  const requests=research.requests||[];
  const executor=research.executor||{};
  const executorNode=$("#research-executor-state");
  executorNode.className=`executor-state ${executor.connected?"is-connected":"is-pending"}`;
  executorNode.innerHTML=`<i></i> ${esc(executor.connected?(executor.label||"Ejecutor conectado"):(executor.label||"Ejecutor pendiente"))}`;
  const guard=store.data.costs?.zeroCostHotels||{};
  const zeroCostCopy=$("#hotel-zero-cost-copy");
  if(zeroCostCopy) {
    const search=guard.services?.["places-text-search-pro"];
    const details=guard.services?.["place-details-enterprise"];
    zeroCostCopy.innerHTML=guard.status==="CONFIRMED_ZERO"
      ? `<strong>$0 confirmado.</strong> Quedan ${esc(search?.remaining||0)} búsquedas y ${esc(details?.remaining||0)} detalles dentro del límite seguro de esta campaña.`
      : guard.status==="BLOCKED"
        ? "<strong>Consultas pagas bloqueadas.</strong> El lote queda listo para continuar mediante Chrome y fuentes públicas."
        : "<strong>Uso de Google todavía no verificado.</strong> Ninguna llamada de Places se ejecutará; el lote queda listo para continuar con Chrome y fuentes públicas.";
  }
  $("#research-monitor-caption").textContent=requests.length
    ? `${requests.length} pedido${requests.length===1?"":"s"} registrado${requests.length===1?"":"s"} · actualización automática cada 30 segundos`
    : "Todavía no hay pedidos de research registrados";
  $("#research-summary").innerHTML=[
    ["Pendientes",summary.pending||0,"pending"],
    ["Procesando",summary.running||0,"running"],
    ["Completados",summary.completed||0,"done"],
    ["Bloqueados",summary.blocked||0,"blocked"]
  ].map(([label,value,tone])=>`<article class="research-summary-item is-${tone}"><span>${esc(label)}</span><strong>${value}</strong></article>`).join("");
  if(!requests.length) {
    $("#research-run-list").innerHTML=`<div class="research-empty"><span>＋</span><div><strong>Creá tu primer research</strong><p>Configurá los campos de arriba y el pedido aparecerá acá.</p></div></div>`;
    return;
  }
  $("#research-run-list").innerHTML=requests.map(row=>{
    const request=row.request||{};
    const status=String(row.status||"NEW").toUpperCase();
    const progress=row.progress||{completed:0,total:request.quantity||0,percent:0};
    const details=row.action==="CONTINUE_RESEARCH"
      ? "Retoma el siguiente lote incompleto respetando el último avance confirmado."
      : [request.industry,request.location,request.employeeSize&&request.employeeSize!=="any"?`${request.employeeSize} empleados`:"Sin límite de tamaño"].filter(Boolean).join(" · ");
    const coverage=row.action==="CONTINUE_RESEARCH"
      ? "Continuación segura"
      : `${request.reviews==="none"?"Sin reseñas":`Reseñas 1–3 · mínimo ${request.minimumReviews||0}`} · ${request.contact==="email"?"Email":request.contact==="whatsapp"?"WhatsApp":"Email + WhatsApp"}`;
    const progressCopy=status==="DONE"
      ? `${progress.completed||progress.total}/${progress.total||progress.completed} completados`
      : status==="IN_PROGRESS"
        ? `${progress.completed||0}/${progress.total||request.quantity||0} procesados`
        : status==="NEW"||status==="PENDING"||status==="READY"
          ? "Esperando asignación del ejecutor"
          : row.error||researchStatusLabels[status]||status;
    return `<article class="research-run ${researchStatusClass(status)}">
      <div class="research-run-mark">${status==="IN_PROGRESS"?'<span class="research-spinner"></span>':status==="DONE"?"✓":status==="BLOCKED"||status==="FAILED"?"!":"⌛"}</div>
      <div class="research-run-main">
        <div class="research-run-heading"><div><strong>${esc(researchRequestTitle(row))}</strong><p>${esc(details)}</p></div><span class="research-status-chip ${researchStatusClass(status)}">${esc(researchStatusLabels[status]||status)}</span></div>
        <div class="research-run-meta"><span>${esc(coverage)}</span>${request.destination?`<span>Destino: ${esc(request.destination)}</span>`:""}<span>${esc(relativeDate(row.updatedAt||row.createdAt))}</span></div>
        <div class="research-progress"><i style="width:${Math.max(0,Math.min(100,Number(progress.percent)||0))}%"></i></div>
        <small class="research-progress-copy">${esc(progressCopy)}</small>
      </div>
    </article>`;
  }).join("");
}

const automationStatusLabels={
  ACTIVE:"Activo",PAUSED:"Pausado",PANIC_STOPPED:"Detenido",INACTIVE:"Sin activar",
  WORKING:"Trabajando",QUEUED:"En cola",READY:"Listo",IDLE:"En espera",LOCKED:"Protegido",
  WAITING_HEARTBEAT:"Esperando heartbeat",STOPPED:"Detenido",BLOCKED:"Bloqueado",WAITING_APPROVAL:"Esperando aprobación",
  NEW:"Pendiente",IN_PROGRESS:"En ejecución",DONE:"Completado",CANCELLED:"Cancelado"
};

function automationStatusClass(status) {
  if(["ACTIVE","WORKING","READY","DONE"].includes(status)) return "is-live";
  if(["PANIC_STOPPED","STOPPED","BLOCKED"].includes(status)) return "is-danger";
  if(["PAUSED","WAITING_HEARTBEAT","WAITING_APPROVAL","QUEUED"].includes(status)) return "is-waiting";
  if(status==="LOCKED") return "is-locked";
  return "is-idle";
}

function renderAutomation() {
  const automation=store.data.automation||{};
  const executor=automation.executor||{};
  const config=automation.config||{};
  const status=automation.status||"INACTIVE";
  const statusCard=$("#automation-status-card");
  statusCard.className=`automation-status-card ${automationStatusClass(status)}`;
  $("#automation-status").textContent=automationStatusLabels[status]||status;
  $("#automation-executor").textContent=executor.connected
    ? `${executor.label||"Heartbeat conectado"} · ${relativeDate(executor.heartbeatAt)}`
    : executor.label||"Heartbeat sin señal reciente";
  $("#nav-automation-state").textContent=status==="ACTIVE"?"ON":status==="PAUSED"?"II":status==="PANIC_STOPPED"?"STOP":"—";
  $("#automation-team-caption").textContent=executor.detail||"Los estados aparecen cuando llegan evidencias durables.";

  $("#automation-interval").value=String(config.intervalMinutes||10);
  $("#automation-batch-size").value=String(config.batchSize||25);
  $("#automation-specialists").value=String(config.maxSpecialists||3);
  $("#automation-research").checked=config.autoResearch!==false;
  $("#automation-copy").checked=config.autoCopy!==false;
  $("#automation-qa").checked=config.autoQa!==false;

  const lanes=automation.lanes||[];
  $("#automation-lanes").innerHTML=lanes.length?lanes.map(lane=>`
    <article class="automation-lane ${automationStatusClass(lane.status)}">
      <span class="automation-lane-icon">${lane.id==="email"?"@":lane.id==="whatsapp"?"WA":lane.id==="research"?"R":lane.id==="copy"?"C":lane.id==="qa"?"Q":"W"}</span>
      <div><strong>${esc(lane.label)}</strong><p>${esc(lane.detail||"")}</p></div>
      <b>${esc(automationStatusLabels[lane.status]||lane.status)}</b>
    </article>`).join(""):'<div class="empty-state">Todavía no hay estados de agentes.</div>';

  const counters=automation.counters||{};
  $("#automation-counters").innerHTML=[
    ["Órdenes pendientes",counters.pendingCommands||0],
    ["En ejecución",counters.activeCommands||0],
    ["Esperan aprobación",counters.waitingApproval||0],
    ["Opt-ins válidos",counters.verifiedOptIns||0]
  ].map(([label,value])=>`<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("");
  $("#automation-email-gate").textContent=automation.gates?.email||"QA + aprobación de lote + destinatario verificable.";
  $("#automation-whatsapp-gate").textContent=automation.gates?.whatsapp||"Email previo + opt-in + aprobación de lote.";

  const commands=automation.recentCommands||[];
  const actionLabels={PIPELINE_ACTIVATE:"Activar equipo",PIPELINE_PAUSE:"Pausar equipo",PIPELINE_RESUME:"Continuar equipo",PIPELINE_PANIC_STOP:"Detener todo",PIPELINE_UPDATE_CONFIG:"Actualizar configuración",REQUEST_RESEARCH:"Nuevo research",CONTINUE_RESEARCH:"Continuar research",RUN_QA:"Ejecutar QA",PREPARE_DRAFTS:"Preparar borradores",PIPELINE_HEARTBEAT:"Heartbeat"};
  $("#automation-command-list").innerHTML=commands.length?commands.map(command=>{
    const progress=command.progress&&typeof command.progress==="object"?[command.progress.completed,command.progress.total].filter(value=>value!==undefined).join("/"):command.progress;
    const detail=[command.scope,command.leaseOwner?`Lease: ${command.leaseOwner}`:"",command.attempt?`Intento ${command.attempt}`:"",progress?`Avance ${progress}`:"",command.error?`Error: ${command.error}`:""].filter(Boolean).join(" · ");
    return `
    <article class="automation-command">
      <span class="command-state ${automationStatusClass(command.status)}"></span>
      <div><strong>${esc(actionLabels[command.action]||command.action)}</strong><p>${esc(detail||"Pipeline comercial")}</p></div>
      <div><b>${esc(automationStatusLabels[command.status]||command.status)}</b><time>${esc(relativeDate(command.updatedAt||command.createdAt))}</time></div>
    </article>`;
  }).join(""):'<div class="empty-state">Todavía no hay órdenes registradas.</div>';
}

function pipelineConfigFromForm() {
  return {
    intervalMinutes:Number($("#automation-interval").value),
    batchSize:Number($("#automation-batch-size").value),
    maxSpecialists:Number($("#automation-specialists").value),
    autoResearch:$("#automation-research").checked,
    autoCopy:$("#automation-copy").checked,
    autoQa:$("#automation-qa").checked,
    emailMode:"APPROVAL_REQUIRED",
    whatsappMode:"OPTIN_AND_APPROVAL_REQUIRED",
    dryRun:true
  };
}

async function requestPipelineControl(action) {
  if(action==="PIPELINE_PANIC_STOP"&&!window.confirm("Esto detendrá el trabajo automático pendiente. Los datos ya guardados no se borrarán. ¿Querés continuar?")) return;
  const buttons=$$("[data-pipeline-action], #automation-config-form button");
  buttons.forEach(button=>button.disabled=true);
  const confirmation=$("#automation-confirmation");
  confirmation.className="automation-confirmation is-working";
  confirmation.textContent="Guardando la orden…";
  try {
    const response=await fetch("/api/automation/control",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,config:pipelineConfigFromForm(),confirmed:action==="PIPELINE_PANIC_STOP"})});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||"No se pudo registrar la orden");
    store.data.automation=payload.automation||store.data.automation;
    renderAutomation();
    confirmation.className="automation-confirmation is-success";
    confirmation.textContent=`Orden guardada: ${automationStatusLabels[store.data.automation?.status]||action}. Esperando confirmación del heartbeat.`;
    toast("Orden registrada sin ejecutar envíos externos.");
    setTimeout(()=>loadData(true),1500);
  } catch(error) {
    confirmation.className="automation-confirmation is-error";
    confirmation.textContent=error.message||"No se pudo registrar la orden.";
    toast(confirmation.textContent,true);
  } finally {
    buttons.forEach(button=>button.disabled=false);
  }
}

function renderAll() {
  renderMetrics();
  populateRubroFilter();
  applyFilters(false);
  renderEvents();
  renderQueue();
  renderChannels();
  renderSync();
  renderResearch();
  renderAutomation();
  renderCosts();
  updateCostSimulator();
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

function openDrawer(prospectId) {
  const prospect=store.data.prospects.find(row=>row.prospectId===prospectId);
  if(!prospect) return;
  store.selected=prospect;
  $("#drawer-rubro").textContent=prospect.rubro||"Sin rubro";
  $("#drawer-company").textContent=prospect.empresa||"Sin nombre";
  $("#drawer-location").textContent=prospect.ubicacion||"Sin ubicación";
  $("#drawer-rating").textContent=prospect.rating?`★ ${prospect.rating}`:"Sin rating";
  $("#drawer-reviews").textContent=prospect.phase==="contacts"?"Fase 2":prospect.reviewsAnalyzed||"Cobertura pendiente";
  $("#drawer-analysis").textContent=prospect.phase==="contacts"?"El análisis de reseñas se realizará sólo cuando se autorice la fase 2.":prospect.analysis||"Análisis pendiente.";
  $("#drawer-problems").textContent=prospect.phase==="contacts"?"En esta fase se validan únicamente los contactos corporativos.":prospect.problems||"No se registraron problemas.";
  $("#drawer-contacts").innerHTML=[
    {channel:"EMAIL",label:"Email",value:prospect.email,copy:prospect.email},{channel:"WHATSAPP",label:"WhatsApp",value:prospect.whatsapp,copy:waCopyValue(prospect)}
  ].map(item=>`<article class="contact-card ${item.value?"":"is-missing"}"><div><span>${item.label}</span><strong>${esc(item.value||"No disponible")}</strong></div><div class="contact-card-actions">${item.value?`${prospect.phase==="contacts"?"":`<button class="contact-write" data-drawer-write="${item.channel}">Escribir</button>`}<button data-drawer-copy="${esc(item.copy)}" data-label="${item.label}">Copiar</button>`:`<small>Sin dato</small>`}</div></article>`).join("");
  $$("[data-drawer-copy]").forEach(button=>button.addEventListener("click",()=>copy(button.dataset.drawerCopy,button.dataset.label)));
  $$("[data-drawer-write]").forEach(button=>button.addEventListener("click",()=>{store.messageChannel=button.dataset.drawerWrite;openSendDialog();}));
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
  const contactsOnly=prospect.phase==="contacts";
  $("#open-send").hidden=contactsOnly;
  $("#open-send").disabled=contactsOnly||!recipient;
  $("#open-send").textContent=!recipient?"Canal no disponible":`Escribir por ${store.messageChannel==="EMAIL"?"email":"WhatsApp"}`;
  $("#open-send").classList.toggle("button-primary",Boolean(recipient));
  $("#open-send").classList.toggle("button-secondary",!recipient);
  $("#drawer-send-status").textContent=contactsOnly?"Fase 1 activa: copiar y validar contactos. Los mensajes están deshabilitados.":blocker?`Podés preparar el mensaje. Para enviarlo: ${sendErrors[blocker]||blocker}`:"Todo listo para enviar.";
  $("#drawer-send-status").classList.toggle("is-ready",!blocker);
}

function openComposer(prospectId,channel) {
  const prospect=store.data.prospects.find(row=>row.prospectId===prospectId);
  if(!prospect) return toast("No encontramos este contacto. Actualizá los datos.",true);
  if(prospect.phase==="contacts") return toast("Los mensajes de hoteles se habilitarán en la fase 2.",true);
  store.selected=prospect;
  store.messageChannel=channel==="WHATSAPP"?"WHATSAPP":"EMAIL";
  openSendDialog();
}

function openSendDialog() {
  const prospect=store.selected;
  if(!prospect) return;
  const isWa=store.messageChannel==="WHATSAPP";
  const recipient=isWa?waCopyValue(prospect):prospect.email;
  const message=isWa?prospect.whatsappMessage:prospect.emailMessage;
  if(!recipient) return toast("Este prospecto no tiene un contacto verificable para el canal.",true);
  $("#composer-kicker").textContent=isWa?"Mensaje por WhatsApp":"Mensaje por email";
  $("#send-title").textContent=`Escribirle a ${prospect.empresa}`;
  $("#send-recipient").textContent=recipient;
  $("#send-message").value=message||"";
  $$("[data-composer-channel]").forEach(button=>{
    const channel=button.dataset.composerChannel;
    const available=channel==="EMAIL"?Boolean(prospect.email):Boolean(prospect.whatsapp);
    button.disabled=!available;
    button.classList.toggle("is-active",channel===store.messageChannel);
  });
  $("#wa-optin").classList.toggle("is-visible",isWa);
  if(isWa) {
    const optIn=prospect.whatsappOptIn||{};
    $("#optin-status").textContent=optIn.eligible?`Contacto habilitado · ${relativeDate(optIn.recordedAt)}`:"Este contacto todavía no escribió por WhatsApp";
    $("#optin-status").classList.toggle("is-verified",optIn.eligible===true);
  }
  const blocker=sendBlocker(prospect,store.messageChannel);
  $("#send-error").textContent=blocker?`Podés escribir y guardar el borrador. Para enviarlo falta: ${sendErrors[blocker]||blocker}`:"El mensaje está listo para enviar.";
  $("#send-error").classList.toggle("is-visible",true);
  $("#send-error").classList.toggle("is-ready",!blocker);
  $("#confirm-send").disabled=Boolean(blocker);
  $("#confirm-send").textContent=blocker?"Enviar no disponible":"Enviar ahora";
  $("#save-draft").disabled=!String(message||"").trim();
  $("#save-draft").textContent="Guardar borrador";
  if(!$("#send-dialog").open) $("#send-dialog").showModal();
}

const sendErrors={
  EMAIL_PROVIDER_NOT_CONFIGURED:"el canal de email está conectado, pero todavía está pausado.",
  WHATSAPP_PROVIDER_NOT_CONFIGURED:"la línea de WhatsApp está conectada, pero todavía está pausada.",
  WHATSAPP_PHONE_INVALID:"el número necesita el código internacional, por ejemplo +54.",
  CHANNEL_BLOCKED:"el canal todavía está pausado.",
  INDEPENDENT_QA_REQUIRED:"primero hay que revisar y aprobar este mensaje.",
  BATCH_APPROVAL_REQUIRED:"primero hay que aprobar el lote que contiene este contacto.",
  DURABLE_IDEMPOTENCY_SNAPSHOT_REQUIRED:"Falta reconciliar la cola y el proveedor antes de habilitar el envío.",
  APPROVED_MESSAGE_HASH_REQUIRED:"La versión aprobada no tiene una huella verificable del mensaje.",
  APPROVAL_RECIPIENT_LIMIT_REACHED:"La aprobación ya consumió el número exacto de destinatarios autorizado.",
  DURABLE_OPTIN_REQUIRED:"el contacto todavía no inició o autorizó una conversación por WhatsApp.",
  SERVICE_WINDOW_EXPIRED:"pasaron más de 24 horas desde el último mensaje del contacto.",
  EMAIL_FIRST_REQUIRED:"primero hay que enviar el email inicial.",
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
  MESSAGE_CHANGED:"el texto cambió después de la aprobación y debe revisarse nuevamente.",
  GOOGLE_SHEETS_WRITES_DISABLED:"no se pudo guardar en Google Sheets.",
  MESSAGE_REQUIRED:"escribí un mensaje antes de guardarlo."
  ,HOTEL_CONTACTS_ONLY:"la campaña de hoteles está limitada a contactos hasta autorizar la fase 2."
};

async function saveDraft() {
  const prospect=store.selected;
  const message=$("#send-message").value.trim();
  if(!prospect||!message) return toast("Escribí un mensaje antes de guardarlo.",true);
  const button=$("#save-draft");
  button.disabled=true;
  button.textContent="Guardando…";
  try {
    const response=await fetch("/api/outreach/draft",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({rowNumber:prospect.rowNumber,sourceSheet:prospect.sourceSheet,channel:store.messageChannel,message})});
    const payload=await response.json();
    if(!response.ok) throw new Error(sendErrors[payload.error]||payload.error||"No se pudo guardar el borrador");
    if(store.messageChannel==="EMAIL") prospect.emailMessage=message;
    else prospect.whatsappMessage=message;
    renderMessagePreview();
    button.textContent="Borrador guardado ✓";
    toast("Borrador guardado en Google Sheets.");
  } catch(error) {
    button.disabled=false;
    button.textContent="Guardar borrador";
    toast(error.message||"No se pudo guardar el borrador.",true);
  }
}

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
      sourceSheet:prospect.sourceSheet,
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
    button.textContent=blocker?"Enviar no disponible":"Enviar ahora";
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
    await loadData(true);
    switchView("research");
    $("#research-run-list").scrollIntoView({behavior:"smooth",block:"start"});
  } catch(error) { toast(error.message||"No se pudo registrar la tarea.",true); }
}

function showResearchResult(message,isError=false) {
  const node=$("#research-result");
  node.textContent=message;
  node.classList.add("is-visible");
  node.classList.toggle("is-error",isError);
}

async function createResearchRequest(input,button) {
  const original=button.innerHTML;
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
    await loadData(true);
    $("#research-run-list").scrollIntoView({behavior:"smooth",block:"start"});
  } catch(error) {
    const message=error.message==="RESEARCH_INDUSTRY_REQUIRED"?"Indicá el rubro que querés investigar.":error.message;
    showResearchResult(message||"No se pudo registrar el pedido.",true);
    toast(message||"No se pudo registrar el pedido.",true);
  } finally {
    button.disabled=false;
    button.classList.remove("is-loading");
    button.innerHTML=original;
  }
}

async function submitResearchForm(event) {
  event.preventDefault();
  const hotelLatam=$("#research-business-type").value==="hoteles"&&$("#research-destination").value==="Hoteles_LATAM_500";
  await createResearchRequest({
    batchName:$("#research-batch-name").value,
    quantity:Number($("#research-quantity").value),
    priority:$("#research-priority").value,
    businessType:$("#research-business-type").value,
    industry:$("#research-industry").value,
    employeeSize:$("#research-employee-size").value,
    country:$("#research-country").value,
    region:$("#research-region").value,
    excludeLargeCorporations:$("#research-exclude-large").checked,
    reviews:$("#research-reviews").value,
    minimumReviews:Number($("#research-minimum-reviews").value),
    contact:$("#research-contact").value,
    destination:$("#research-destination").value,
    objective:$("#research-objective").value,
    campaignId:$("#research-business-type").value==="hoteles"?(hotelLatam?"hoteles-latam-500":"hoteles-argentina-300"):"",
    phase:$("#research-business-type").value==="hoteles"?"contacts":"full",
    professionalOperation:$("#research-business-type").value==="hoteles",
    zeroCostMode:$("#research-business-type").value==="hoteles"
  },$("#research-form-submit"));
}

function selectedText(selector) {
  const node=$(selector);
  return node?.options?.[node.selectedIndex]?.textContent?.trim()||node?.value||"—";
}

function updateResearchPreview() {
  const quantity=Math.max(1,Number($("#research-quantity").value)||1);
  const type=selectedText("#research-business-type").toLocaleLowerCase("es-AR");
  const country=selectedText("#research-country");
  const region=$("#research-region").value;
  $("#research-preview-priority").textContent=$("#research-priority").value;
  $("#research-preview-title").textContent=`${quantity} ${type}`;
  $("#research-preview-subtitle").textContent=`${selectedText("#research-industry")} · ${region?`${region}, `:""}${country}`;
  $("#research-preview-size").textContent=selectedText("#research-employee-size");
  const reviewsEnabled=$("#research-reviews").value!=="none";
  $("#research-minimum-reviews").disabled=!reviewsEnabled;
  $("#research-preview-reviews").textContent=reviewsEnabled?`1–3 estrellas · mínimo ${$("#research-minimum-reviews").value}`:"Sin análisis";
  $("#research-preview-contact").textContent=selectedText("#research-contact");
  $("#research-preview-destination").textContent=selectedText("#research-destination");
}

function alignResearchDefaults() {
  const type=$("#research-business-type").value;
  const hotel=type==="hoteles";
  if(hotel) {
    $("#research-quantity").value="500";
    $("#research-industry").value="Hotelería y alojamiento";
    $("#research-employee-size").value="professional";
    $("#research-country").value="Latinoamérica";
    $("#research-reviews").value="none";
    $("#research-minimum-reviews").value="20";
    $("#research-contact").value="both";
    $("#research-destination").value="Hoteles_LATAM_500";
  } else if(type==="logisticas") {
    $("#research-industry").value="Logística y transporte";
    $("#research-destination").value="Logisticas_LATAM";
  } else if(type==="distribuidoras") {
    if($("#research-industry").value==="Logística y transporte") $("#research-industry").value="Alimentos y bebidas";
    $("#research-destination").value="Distribuidoras_300";
  } else if($("#research-destination").value!=="Prospectos_Custom") {
    $("#research-destination").value="Prospectos_Custom";
  }
  updateResearchPreview();
}

function alignHotelDestination() {
  if($("#research-business-type").value!=="hoteles") return updateResearchPreview();
  const latam=$("#research-destination").value==="Hoteles_LATAM_500"||$("#research-country").value==="Latinoamérica";
  if(latam) {
    $("#research-destination").value="Hoteles_LATAM_500";
    $("#research-country").value="Latinoamérica";
    $("#research-quantity").value="500";
  } else if($("#research-destination").value==="Hoteles_Argentina_300") {
    $("#research-country").value="Argentina";
    $("#research-quantity").value="300";
  }
  updateResearchPreview();
}

async function researchControl(action,label) {
  try {
    const latam=$("#research-destination").value==="Hoteles_LATAM_500";
    const scope=latam?"HOTELS_LATAM_500":"HOTELS_ARGENTINA_300";
    const response=await fetch("/api/actions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,scope,idempotencyKey:`${action}:${scope}:${new Date().toISOString().slice(0,16)}`})});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error);
    toast(payload.deduplicated?`${label} ya estaba registrado.`:`${label} registrado.`);
    await loadData(true);
  } catch(error) { toast(error.message||`No se pudo registrar: ${label}.`,true); }
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
  $("#page-title").textContent={prospects:"Prospectos",research:"Nuevo research",automation:"Automatización",whatsapp:"WhatsApp",activity:"Actividad",channels:"Canales",costs:"Costos",apollo:"Apollo"}[id]||"Prospectos";
  history.replaceState(null,"",`#${id}`);
  if(id==="whatsapp"&&!store.whatsapp.loaded) loadWhatsapp();
}

$$("[data-view]").forEach(button=>button.addEventListener("click",()=>switchView(button.dataset.view)));
["#search","#filter-campaign","#filter-rubro","#filter-contact","#filter-status"].forEach(selector=>$(selector).addEventListener(selector==="#search"?"input":"change",()=>applyFilters()));
$("#clear-filters").addEventListener("click",()=>{$("#search").value="";$("#filter-campaign").value="";$("#filter-rubro").value="";$("#filter-contact").value="";$("#filter-status").value="";applyFilters();});
$("#page-prev").addEventListener("click",()=>{store.page--;renderTable();});
$("#page-next").addEventListener("click",()=>{store.page++;renderTable();});
$("#event-filter").addEventListener("change",renderEvents);
$("#refresh-button").addEventListener("click",()=>loadData());
$("#sync-button").addEventListener("click",requestSync);
$("#hero-sync").addEventListener("click",requestSync);
$("#continue-research").addEventListener("click",enqueueResearch);
$("#research-form").addEventListener("submit",submitResearchForm);
$("#research-refresh").addEventListener("click",()=>loadData());
$("#automation-refresh").addEventListener("click",()=>loadData());
$$('[data-pipeline-action]').forEach(button=>button.addEventListener("click",()=>requestPipelineControl(button.dataset.pipelineAction)));
$("#automation-config-form").addEventListener("submit",event=>{event.preventDefault();requestPipelineControl("PIPELINE_UPDATE_CONFIG");});
$("#research-pause").addEventListener("click",()=>researchControl("PAUSE_RESEARCH","Pausa"));
$("#research-retry").addEventListener("click",()=>researchControl("RETRY_BLOCKED_RESEARCH","Reintento seguro"));
$("#research-business-type").addEventListener("change",alignResearchDefaults);
$("#research-destination").addEventListener("change",alignHotelDestination);
$("#research-country").addEventListener("change",alignHotelDestination);
$$('#research-form input, #research-form select').forEach(node=>node.addEventListener(node.matches('input[type="text"], input[type="number"]')?"input":"change",updateResearchPreview));
$("#apollo-pilot").addEventListener("click",prepareApolloPilot);
$("#cost-settings-form").addEventListener("submit",saveCostSettings);
$$('#cost-simulator input, #cost-simulator select').forEach(node=>node.addEventListener("input",updateCostSimulator));
$("#sim-maps-profile").addEventListener("change",applyMapsProfile);
$$('#sim-places-search-service, #sim-places-search-calls, #sim-place-details-service, #sim-place-details-calls').forEach(node=>node.addEventListener(node.tagName==="SELECT"?"change":"input",()=>{if(!applyingMapsProfile) $("#sim-maps-profile").value="custom";}));
$("#sim-prospects").addEventListener("change",()=>{if($("#sim-maps-profile").value==="optimized") applyMapsProfile();});
$("#cost-fixed").addEventListener("input",updateCostSimulator);
$("#wa-refresh").addEventListener("click",()=>loadWhatsapp());
let waSearchTimer;
$("#wa-search").addEventListener("input",()=>{clearTimeout(waSearchTimer);waSearchTimer=setTimeout(()=>loadWhatsapp(),280);});
$$('[data-wa-filter]').forEach(button=>button.addEventListener("click",()=>{
  store.whatsapp.filter=button.dataset.waFilter;
  $$('[data-wa-filter]').forEach(item=>item.classList.toggle("is-active",item===button));
  renderWhatsappConversations();
}));
$("#wa-chat-phone").addEventListener("click",()=>copy(store.whatsapp.selected?.phone_e164,"Número de WhatsApp"));
$("#wa-mobile-back").addEventListener("click",()=>$(".wa-shell").classList.remove("is-chat-open"));
$("#wa-send").addEventListener("click",openWhatsappSendConfirmation);
$("#wa-reply").addEventListener("input",()=>{
  const prospect=whatsappMatchedProspect(store.whatsapp.selected);
  $("#wa-send").disabled=!prospect||Boolean(sendBlocker(prospect,"WHATSAPP"))||!$("#wa-reply").value.trim();
});
$$("[data-close]").forEach(node=>node.addEventListener("click",closeDrawer));
$$("[data-modal-close]").forEach(node=>node.addEventListener("click",()=>$("#send-dialog").close()));
$$("[data-message-tab]").forEach(button=>button.addEventListener("click",()=>{store.messageChannel=button.dataset.messageTab;renderMessagePreview();}));
$$("[data-composer-channel]").forEach(button=>button.addEventListener("click",()=>{store.messageChannel=button.dataset.composerChannel;openSendDialog();}));
$("#copy-message").addEventListener("click",()=>copy($("#message-preview").textContent,"Mensaje"));
$("#copy-recipient").addEventListener("click",()=>copy($("#send-recipient").textContent,"Destinatario"));
$("#drawer-web").addEventListener("click",()=>store.selected?.web&&window.open(store.selected.web,"_blank","noopener"));
$("#open-send").addEventListener("click",openSendDialog);
$("#save-draft").addEventListener("click",saveDraft);
$("#send-message").addEventListener("input",()=>{$("#save-draft").disabled=!$("#send-message").value.trim();});
$("#send-form").addEventListener("submit",sendMessage);
document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();$("#search").focus();}if(event.key==="Escape")closeDrawer();});

const initialView=["prospects","research","automation","whatsapp","activity","channels","costs","apollo"].includes(location.hash.slice(1))?location.hash.slice(1):"prospects";
alignResearchDefaults();
switchView(initialView);
loadData();
setInterval(()=>loadData(true),30_000);
