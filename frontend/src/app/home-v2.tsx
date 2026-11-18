'use client';

import { ArrowDown, ArrowRight, ArrowUpRight, Mail, Menu, MessageCircle, Send, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const WHATSAPP_URL = 'https://wa.me/5491130035679';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wis-backend.xbgh9n.easypanel.host/api';

const services = [
  ['01', 'Atención', 'Respuestas con contexto para cada consulta que llega.'],
  ['02', 'Seguimiento', 'Un próximo paso claro para cada oportunidad abierta.'],
  ['03', 'Operación', 'Procesos conectados para que la información circule.'],
] as const;

const integrations = [
  ['01', 'WhatsApp', 'Atención y conversaciones'],
  ['02', 'CRM', 'Seguimiento y oportunidades'],
  ['03', 'Google Sheets', 'Datos y operación diaria'],
  ['04', 'n8n / APIs', 'Automatizaciones e integraciones'],
] as const;

const caseBrands = ['Quality Hard', 'IMEPHO', 'Movimientos Indumec', 'Metzeler Joyas', 'Dugas'];

function BrandMark() {
  return <span className="v2-brand-mark" aria-hidden="true"><Image src="/logo-transparent.png" alt="" fill sizes="76px" priority /></span>;
}

export default function HomeV2() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.v2-reveal'));
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('v2-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('v2-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const marquee = marqueeRef.current;
    if (!marquee) return;
    let startX = 0;
    let startScrollLeft = 0;
    let dragging = false;
    const down = (event: PointerEvent) => { if (event.pointerType === 'mouse' && event.button !== 0) return; startX = event.clientX; startScrollLeft = marquee.scrollLeft; dragging = true; marquee.classList.add('v2-dragging'); };
    const move = (event: PointerEvent) => { if (dragging) marquee.scrollLeft = startScrollLeft - (event.clientX - startX); };
    const up = () => { dragging = false; marquee.classList.remove('v2-dragging'); };
    marquee.addEventListener('pointerdown', down); marquee.addEventListener('pointermove', move); marquee.addEventListener('pointerup', up); marquee.addEventListener('pointercancel', up);
    return () => { marquee.removeEventListener('pointerdown', down); marquee.removeEventListener('pointermove', move); marquee.removeEventListener('pointerup', up); marquee.removeEventListener('pointercancel', up); };
  }, []);

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormStatus('sending');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form.entries())) });
      if (!response.ok) throw new Error('contact-failed');
      setFormStatus('success');
      event.currentTarget.reset();
    } catch { setFormStatus('error'); }
  }

  return <main className="v2-site">
    <div className="v2-progress" />
    <div className="v2-topline"><span className="v2-dot" /> WIS / Sistemas inteligentes para empresas <span>·</span> Argentina + LATAM</div>
    <nav className="v2-nav">
      <a href="#inicio" className="v2-brand" aria-label="WIS Agency, inicio"><BrandMark /><span>Work in silence</span></a>
      <div className={`v2-nav-links ${menuOpen ? 'v2-open' : ''}`}><a href="#sistema" onClick={() => setMenuOpen(false)}>Sistema</a><a href="#servicios" onClick={() => setMenuOpen(false)}>Qué hacemos</a><a href="#casos" onClick={() => setMenuOpen(false)}>Casos</a><a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a></div>
      <a className="v2-nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Hablemos <ArrowUpRight size={15} /></a>
      <button className="v2-menu" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
    </nav>

    <section id="inicio" className="v2-hero">
      <video autoPlay loop muted playsInline preload="auto" poster="/og-image.png" aria-hidden="true"><source src="/wis-loop.mp4" type="video/mp4" /></video><div className="v2-hero-shade" />
      <div className="v2-hero-content"><span className="v2-kicker">WIS / 2026 <i /> Work in silence</span><h1>La tecnología que<br /><span>trabaja por vos.</span></h1><p>Diseñamos sistemas con IA para ordenar la atención, el seguimiento y los procesos de tu empresa.</p><div className="v2-actions"><a className="v2-button v2-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Hablemos de tu operación <ArrowRight size={17} /></a><a className="v2-button v2-ghost" href="#sistema">Conocé el enfoque <ArrowDown size={15} /></a></div></div>
      <div className="v2-hero-meta"><span>MOTION LOOP / 01</span><span>IA · INTEGRACIONES · PROCESOS</span></div><a className="v2-scroll" href="#sistema">Scroll <ArrowDown size={14} /></a>
    </section>

    <section id="sistema" className="v2-intro v2-reveal"><div className="v2-shell v2-intro-grid"><div><span className="v2-section-kicker">01 / El problema</span><h2>Tu empresa no necesita más herramientas.<br /><span>Necesita que trabajen juntas.</span></h2></div><div><p>Integramos inteligencia artificial, automatizaciones y las herramientas que tu equipo ya usa para que cada tarea tenga un próximo paso claro.</p><a className="v2-text-link" href="#servicios">Ver qué ordenamos <ArrowUpRight size={15} /></a></div></div></section>

    <section id="servicios" className="v2-services v2-reveal"><div className="v2-shell"><div className="v2-section-head"><div><span className="v2-section-kicker">02 / Lo que ordenamos</span><h2>La tecnología tiene que <span>trabajar.</span></h2></div><p>Elegimos el punto donde más se frena tu operación y construimos desde ahí.</p></div><div className="v2-service-list">{services.map(([number, title, text]) => <article key={number} className="v2-service"><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><ArrowUpRight size={20} /></article>)}</div></div></section>

    <section className="v2-ecosystem v2-reveal"><div className="v2-shell v2-ecosystem-grid"><div><span className="v2-section-kicker">03 / Conectamos lo que ya usás</span><h2>WIS se adapta a tu operación.<br /><span>No al revés.</span></h2></div><div><p>Integramos las herramientas que tu equipo ya conoce para que la información circule sin sumar otra capa de complejidad.</p><div className="v2-integration-list">{integrations.map(([number, name, detail]) => <div key={number}><small>{number}</small><strong>{name}</strong><span>{detail}</span></div>)}</div></div></div></section>

    <section id="casos" className="v2-cases v2-reveal"><video autoPlay loop muted playsInline preload="auto" poster="/og-image.png" aria-hidden="true"><source src="/wis-loop.mp4" type="video/mp4" /></video><div className="v2-cases-shade" /><div className="v2-shell v2-cases-content"><span className="v2-section-kicker">04 / Clientes</span><h2>Marcas que ya están<br /><span>trabajando con WIS.</span></h2><p>Experiencias construidas con equipos que necesitaban ordenar la atención, el seguimiento o sus procesos.</p><div ref={marqueeRef} className="v2-reel" aria-label="Clientes de WIS, desplazable"><div className="v2-reel-track">{[0, 1].flatMap((copy) => caseBrands.map((brand) => <span key={`${copy}-${brand}`}>{brand}<i>✦</i></span>))}</div></div></div></section>

    <section className="v2-method v2-reveal"><div className="v2-shell v2-method-grid"><div><span className="v2-section-kicker">05 / Cómo trabajamos</span><h2>Primero entendemos.<br />Después <span>construimos.</span></h2><p>Cada operación tiene un punto donde la información se corta. Empezamos por encontrarlo.</p></div><div className="v2-method-list"><article><b>01</b><div><h3>Entender</h3><p>Mapeamos cómo entra la información, quién la recibe y dónde se pierde.</p></div></article><article><b>02</b><div><h3>Diseñar</h3><p>Definimos el recorrido, las reglas y los lugares donde la tecnología puede ayudar.</p></div></article><article><b>03</b><div><h3>Implementar</h3><p>Construimos, probamos con el equipo y dejamos visible cómo seguir mejorando.</p></div></article></div></div></section>

    <section id="contacto" className="v2-contact v2-reveal"><div className="v2-shell v2-contact-grid"><div><span className="v2-section-kicker">06 / El próximo paso</span><h2>Hablemos de tu<br /><span>próximo sistema.</span></h2><p>Contanos cómo funciona hoy tu empresa y dónde querés ganar tiempo, orden o capacidad.</p><div className="v2-direct"><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><span className="v2-whatsapp"><MessageCircle size={14} /></span> WhatsApp directo <ArrowUpRight size={14} /></a><a href="mailto:ortu@wis-agency.com"><Mail size={16} /> ortu@wis-agency.com <ArrowUpRight size={14} /></a></div></div><form className="v2-form" onSubmit={submitContact}><div className="v2-form-heading"><span>PRIMERA CONVERSACIÓN</span><b>Directa y sin compromiso.</b></div><label>Nombre<input name="name" required placeholder="Tu nombre" /></label><label>Empresa<input name="company" placeholder="Nombre de tu empresa" /></label><label>Email<input name="email" required type="email" placeholder="tu@email.com" /></label><label>¿Qué necesitás resolver?<textarea name="message" required rows={4} placeholder="Contanos brevemente qué querés mejorar..." /></label><button className="v2-button v2-primary" disabled={formStatus === 'sending'}>{formStatus === 'sending' ? 'Enviando...' : 'Enviar consulta'} <Send size={16} /></button>{formStatus === 'success' && <p className="v2-form-success">Recibimos tu mensaje. Te vamos a responder pronto.</p>}{formStatus === 'error' && <p className="v2-form-error">No pudimos enviarlo. Escribinos directo por WhatsApp.</p>}</form></div></section>

    <footer className="v2-footer v2-shell"><div><BrandMark /><span>Work in silence.</span></div><div className="v2-footer-links"><a href="#sistema">Sistema</a><a href="#servicios">Qué hacemos</a><a href="#casos">Casos</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={14} /></a></div><small>© 2026 WIS Agency · Argentina + LATAM</small></footer>
  </main>;
}
