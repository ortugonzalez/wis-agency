'use client';

import { ArrowDown, ArrowRight, ArrowUpRight, Check, Mail, Menu, MessageCircle, Send, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { cases, services } from './site-content';

const WHATSAPP_URL = 'https://wa.me/5491130035679';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wis-backend.xbgh9n.easypanel.host/api';

const demos = [
  { key: 'atencion', label: 'Una consulta entra', channel: 'WhatsApp / Atención', input: 'Hola, quería saber si tienen disponibilidad y cómo puedo avanzar.', action: 'WIS clasifica la consulta, busca el contexto y deriva con la información lista.', output: 'Respuesta enviada · oportunidad registrada' },
  { key: 'seguimiento', label: 'Una oportunidad avanza', channel: 'CRM / Seguimiento', input: 'Presupuesto enviado hace 3 días · sin respuesta', action: 'WIS identifica el próximo paso y activa el seguimiento que corresponde.', output: 'Tarea creada · responsable notificado' },
  { key: 'operacion', label: 'Un dato llega', channel: 'Planilla / Operación', input: 'Nuevo pedido cargado en Google Sheets', action: 'WIS valida los datos, actualiza el sistema y avisa si algo necesita revisión.', output: 'Información sincronizada · trazabilidad activa' },
] as const;

function BrandMark() {
  return <span className="v3-brand-mark" aria-hidden="true"><Image src="/logo-transparent.png" alt="" fill sizes="64px" priority /></span>;
}

export default function HomeV2() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demo, setDemo] = useState<(typeof demos)[number]['key']>('atencion');
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [dragging, setDragging] = useState(false);
  const reelRef = useRef<HTMLDivElement>(null);
  const demoItem = demos.find((item) => item.key === demo) || demos[0];

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.v3-reveal'));
    if (!('IntersectionObserver' in window)) { nodes.forEach((node) => node.classList.add('v3-visible')); return; }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('v3-visible'); observer.unobserve(entry.target); } }), { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const progress = document.querySelector<HTMLElement>('.v3-progress');
    if (!progress) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => {
    const reel = reelRef.current;
    if (!reel) return;
    let startX = 0;
    let startScroll = 0;
    const down = (event: PointerEvent) => { if (event.pointerType === 'mouse' && event.button !== 0) return; startX = event.clientX; startScroll = reel.scrollLeft; reel.setPointerCapture?.(event.pointerId); setDragging(true); };
    const move = (event: PointerEvent) => { if (reel.hasPointerCapture?.(event.pointerId)) reel.scrollLeft = startScroll - (event.clientX - startX); };
    const up = () => setDragging(false);
    reel.addEventListener('pointerdown', down); reel.addEventListener('pointermove', move); reel.addEventListener('pointerup', up); reel.addEventListener('pointercancel', up); reel.addEventListener('lostpointercapture', up);
    return () => { reel.removeEventListener('pointerdown', down); reel.removeEventListener('pointermove', move); reel.removeEventListener('pointerup', up); reel.removeEventListener('pointercancel', up); reel.removeEventListener('lostpointercapture', up); };
  }, []);

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormStatus('sending');
    const form = new FormData(event.currentTarget);
    try { const response = await fetch(`${API_URL}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form.entries())) }); if (!response.ok) throw new Error('contact-failed'); setFormStatus('success'); event.currentTarget.reset(); } catch { setFormStatus('error'); }
  }

  return <main className="v3-site">
    <div className="v3-progress" />
    <div className="v3-topline"><span className="v3-dot" /> WIS / Sistemas inteligentes para empresas <span>·</span> Argentina + LATAM</div>
    <nav className="v3-nav" aria-label="Navegación principal">
      <a href="#inicio" className="v3-brand" aria-label="WIS Agency, inicio"><BrandMark /><span>Work in silence</span></a>
      <div className={`v3-nav-links ${menuOpen ? 'v3-open' : ''}`}><a href="#sistema" onClick={() => setMenuOpen(false)}>Sistema</a><a href="#servicios" onClick={() => setMenuOpen(false)}>Qué hacemos</a><a href="#casos" onClick={() => setMenuOpen(false)}>Casos</a><a href="#contacto" onClick={() => setMenuOpen(false)}>Diagnóstico</a></div>
      <a className="v3-nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Hablemos <ArrowUpRight size={15} /></a><button className="v3-menu" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
    </nav>

    <section id="inicio" className="v3-hero">
      <video autoPlay loop muted playsInline preload="auto" poster="/og-image.png" aria-hidden="true"><source src="/wis-loop.mp4" type="video/mp4" /></video><div className="v3-hero-shade" />
      <div className="v3-hero-content"><span className="v3-kicker">WIS / 2026 <i /> Work in silence</span><h1>Hay cosas que<br /><span>tu equipo no debería</span><br />seguir haciendo<br /><span>a mano.</span></h1><p>WIS diseña sistemas para ordenar la atención, el seguimiento y los procesos que hoy dependen demasiado de una persona.</p><div className="v3-actions"><a className="v3-button v3-primary" href="#contacto">Diagnóstico operativo <ArrowRight size={17} /></a><a className="v3-button v3-ghost" href="#demo">Verlo en acción <ArrowDown size={15} /></a></div></div>
      <div className="v3-hero-note"><span>PRIMERA CONVERSACIÓN</span><b>30 min · sin compromiso</b></div><div className="v3-hero-meta"><span>MOTION LOOP / 01</span><span>IA · INTEGRACIONES · PROCESOS</span></div>
    </section>

    <section id="sistema" className="v3-intro v3-reveal"><div className="v3-shell v3-intro-grid"><div><span className="v3-section-kicker">01 / El problema</span><h2>La operación no se rompe por falta de esfuerzo.<br /><span>Se rompe cuando todo depende de alguien.</span></h2></div><div><p>Cuando una consulta queda sin respuesta, un presupuesto no tiene seguimiento o un dato se copia de una planilla a otra, el problema no es la voluntad del equipo. Es que falta un sistema.</p><a className="v3-text-link" href="#demo">Ver un proceso WIS <ArrowUpRight size={15} /></a></div></div></section>

    <section id="demo" className="v3-demo v3-reveal"><div className="v3-shell"><div className="v3-section-head"><div><span className="v3-section-kicker">02 / Verlo en acción</span><h2>No te contamos lo que puede hacer.<br /><span>Te mostramos el recorrido.</span></h2></div><p>Una misma lógica: la información entra, el sistema decide y el equipo recibe un próximo paso claro.</p></div><div className="v3-demo-layout"><div className="v3-demo-tabs" role="tablist" aria-label="Procesos WIS">{demos.map((item, index) => <button key={item.key} className={demo === item.key ? 'is-active' : ''} role="tab" aria-selected={demo === item.key} onClick={() => setDemo(item.key)}><span>0{index + 1}</span>{item.label}<ArrowRight size={16} /></button>)}</div><div className="v3-demo-stage" key={demo}><div className="v3-demo-top"><span>{demoItem.channel}</span><span className="v3-live"><i /> sistema activo</span></div><div className="v3-demo-flow"><div className="v3-demo-node"><small>ENTRA</small><strong>{demoItem.input}</strong></div><div className="v3-demo-line"><i /><i /><i /></div><div className="v3-demo-node v3-node-accent"><small>WIS ORDENA</small><strong>{demoItem.action}</strong></div><div className="v3-demo-line"><i /><i /><i /></div><div className="v3-demo-node"><small>AVANZA</small><strong>{demoItem.output}</strong></div></div></div></div></div></section>

    <section id="servicios" className="v3-services v3-reveal"><div className="v3-shell"><div className="v3-section-head"><div><span className="v3-section-kicker">03 / Lo que ordenamos</span><h2>La tecnología tiene que <span>trabajar.</span></h2></div><p>No sumamos herramientas porque sí. Encontramos el punto donde más se frena tu operación y construimos desde ahí.</p></div><div className="v3-service-list">{services.map((service) => <a href={`/servicios/${service.slug}`} key={service.slug} className="v3-service"><span>{service.number}</span><div><h3>{service.name}</h3><p>{service.description}</p></div><ArrowUpRight size={20} /></a>)}</div></div></section>

    <section className="v3-ecosystem v3-reveal"><div className="v3-shell v3-ecosystem-grid"><div><span className="v3-section-kicker">04 / Tu ecosistema</span><h2>WIS se adapta a tu operación.<br /><span>No al revés.</span></h2></div><div><p>Conectamos WhatsApp, CRM, planillas, APIs y sistemas internos cuando eso ayuda a que la información avance. La herramienta es el medio; el proceso es el centro.</p><div className="v3-system-flow"><span>Conversación</span><i>→</i><strong>WIS</strong><i>→</i><span>Decisión</span><i>→</i><span>Próximo paso</span></div></div></div></section>

    <section id="casos" className="v3-cases v3-reveal"><video className="v3-cases-video" autoPlay loop muted playsInline preload="metadata" aria-hidden="true"><source src="/wis-loop.mp4" type="video/mp4" /></video><div className="v3-cases-shade" /><div className="v3-shell"><div className="v3-section-head"><div><span className="v3-section-kicker">05 / Clientes</span><h2>Marcas que ya están<br /><span>trabajando con WIS.</span></h2></div><p>Historias reales, publicadas con contexto y resultados aprobados. Si querés conocer un caso parecido al tuyo, te lo contamos en la primera conversación.</p></div><div ref={reelRef} className={`v3-reel ${dragging ? 'is-dragging' : ''}`} aria-label="Clientes de WIS, arrastrable"><div className="v3-reel-track">{[...cases, ...cases].map((client, index) => <span key={`${client}-${index}`}>{client}<i>✦</i></span>)}</div></div><a href="/casos" className="v3-text-link">Ver clientes de WIS <ArrowUpRight size={15} /></a></div></section>

    <section className="v3-method v3-reveal"><div className="v3-shell v3-method-grid"><div><span className="v3-section-kicker">06 / Cómo trabajamos</span><h2>De la primera conversación<br />a <span>producción.</span></h2><p>Un sistema premium no se mide por lo espectacular que parece, sino por lo bien que funciona cuando el equipo lo usa todos los días.</p></div><div className="v3-method-list"><article><b>01</b><div><h3>Entender</h3><p>Mapeamos el proceso real, sus excepciones y dónde se pierde tiempo.</p><small>Diagnóstico · mapa de oportunidad</small></div></article><article><b>02</b><div><h3>Diseñar</h3><p>Definimos una solución simple, conectada a tus herramientas actuales.</p><small>Arquitectura · recorrido · reglas</small></div></article><article><b>03</b><div><h3>Implementar</h3><p>Construimos y probamos con datos reales antes de ponerla a trabajar.</p><small>Construcción · pruebas · puesta en marcha</small></div></article><article><b>04</b><div><h3>Estabilizar</h3><p>Documentamos, medimos y acompañamos la evolución del sistema.</p><small>Monitoreo · capacitación · mejora</small></div></article></div></div></section>

    <section id="contacto" className="v3-contact v3-reveal"><div className="v3-shell v3-contact-grid"><div><span className="v3-section-kicker">07 / Diagnóstico operativo WIS</span><h2>Encontrá el proceso que más te está <span>frenando.</span></h2><p>En una primera conversación miramos cómo funciona hoy tu empresa y te decimos qué conviene automatizar primero —y qué no.</p><div className="v3-diagnostic"><div><Check size={15} /> 30 minutos</div><div><Check size={15} /> Directo y sin compromiso</div><div><Check size={15} /> Próximo paso claro</div></div><div className="v3-direct"><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><span className="v3-whatsapp"><MessageCircle size={14} /></span> WhatsApp directo <ArrowUpRight size={14} /></a><a href="mailto:ortu@wis-agency.com"><Mail size={16} /> ortu@wis-agency.com <ArrowUpRight size={14} /></a></div></div><form className="v3-form" onSubmit={submitContact}><div className="v3-form-heading"><span>PRIMERA CONVERSACIÓN</span><b>Contanos dónde se corta.</b></div><label>Nombre<input name="name" required placeholder="Tu nombre" /></label><label>Empresa<input name="company" placeholder="Nombre de tu empresa" /></label><label>Email<input name="email" required type="email" placeholder="tu@email.com" /></label><label>¿Qué necesitás resolver?<textarea name="message" required rows={4} placeholder="Una tarea, un seguimiento o un proceso que hoy depende demasiado de una persona..." /></label><button className="v3-button v3-primary" disabled={formStatus === 'sending'}>{formStatus === 'sending' ? 'Enviando...' : 'Pedir diagnóstico'} <Send size={16} /></button>{formStatus === 'success' && <p className="v3-form-success">Recibimos tu mensaje. Te vamos a responder pronto.</p>}{formStatus === 'error' && <p className="v3-form-error">No pudimos enviarlo. Escribinos directo por WhatsApp.</p>}</form></div></section>

    <footer className="v3-footer v3-shell"><div><BrandMark /><span>Work in silence.</span></div><div className="v3-footer-links"><a href="/servicios/agentes-ia-para-atencion">Servicios</a><a href="/casos">Casos</a><a href="/recursos">Recursos</a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={14} /></a><a className="v3-footer-wa" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a></div><small>© 2026 WIS Agency · Argentina + LATAM</small></footer>
    <a className="v3-floating-wa" href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><MessageCircle size={21} /></a>
  </main>;
}
