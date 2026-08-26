'use client';

import { ArrowDown, ArrowRight, ArrowUpRight, Mail, Menu, MessageCircle, Send, Workflow, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const WHATSAPP_URL = 'https://wa.me/5491130035679';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wis-backend.xbgh9n.easypanel.host/api';

const services = [
  ['01', 'Atención', 'Respuestas con contexto para cada consulta que llega.'],
  ['02', 'Seguimiento', 'Un próximo paso claro para cada oportunidad abierta.'],
  ['03', 'Operación', 'Procesos conectados para que la información circule.'],
];

const caseBrands = ['Quality Hard', 'IMEPHO', 'Movimientos Indumec', 'Metzeler Joyas', 'Dugas'];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><Image src="/logo-transparent.png" alt="" fill sizes="76px" priority /></span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const marquee = marqueeRef.current;
    if (!marquee) return;
    let startX = 0;
    let startScrollLeft = 0;
    let isDragging = false;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      startX = event.clientX;
      startScrollLeft = marquee.scrollLeft;
      isDragging = true;
      marquee.classList.add('is-dragging');
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) return;
      marquee.scrollLeft = startScrollLeft - (event.clientX - startX);
    };
    const handlePointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      marquee.classList.remove('is-dragging');
    };
    marquee.addEventListener('pointerdown', handlePointerDown);
    marquee.addEventListener('pointermove', handlePointerMove);
    marquee.addEventListener('pointerup', handlePointerUp);
    marquee.addEventListener('pointercancel', handlePointerUp);
    return () => {
      marquee.removeEventListener('pointerdown', handlePointerDown);
      marquee.removeEventListener('pointermove', handlePointerMove);
      marquee.removeEventListener('pointerup', handlePointerUp);
      marquee.removeEventListener('pointercancel', handlePointerUp);
    };
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
    } catch {
      setFormStatus('error');
    }
  }

  return <main>
    <div className="topline"><span className="topline-dot" /> WIS / sistemas inteligentes para empresas <span className="topline-separator">·</span> Argentina + LATAM</div>

    <nav className="nav-shell">
      <a href="#inicio" className="brand" aria-label="WIS Agency, inicio"><BrandMark /></a>
      <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
        <a href="#que-hacemos" onClick={() => setMenuOpen(false)}>Qué hacemos</a>
        <a href="#casos" onClick={() => setMenuOpen(false)}>Casos</a>
        <a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
      </div>
      <a className="nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Hablemos <ArrowUpRight size={15} /></a>
      <button className="menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
    </nav>

    <section id="inicio" className="hero-film">
      <video className="hero-video" autoPlay loop muted playsInline preload="auto" poster="/og-image.png" aria-hidden="true"><source src="/wis-loop.mp4" type="video/mp4" /></video>
      <div className="hero-video-shade" />
      <div className="hero-video-grain" />
      <div className="hero-film-content section-shell">
        <div className="hero-kicker"><span>WIS / 2026</span><i /><span>WORK IN SILENCE</span></div>
        <h1>La tecnología que<br /><span>trabaja por vos.</span></h1>
        <p>Diseñamos sistemas con IA para ordenar la atención, el seguimiento y los procesos de tu empresa.</p>
        <div className="hero-actions"><a className="button button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Hablemos de tu operación <ArrowRight size={18} /></a><a className="button button-ghost" href="#que-hacemos">Conocé el enfoque <ArrowDown size={16} /></a></div>
      </div>
      <div className="hero-film-meta"><span>MOTION LOOP / 01</span><span>IA · INTEGRACIONES · PROCESOS</span></div>
      <a className="hero-film-scroll" href="#que-hacemos" aria-label="Bajar a qué hacemos"><span>Scroll</span><ArrowDown size={15} /></a>
    </section>

    <section id="que-hacemos" className="section-shell intro-section reveal">
      <div className="intro-copy"><span className="section-kicker">01 / WIS</span><h2>La operación debería avanzar<br /><span>sin pedirte más tiempo.</span></h2></div>
      <div className="intro-side"><p>Integramos inteligencia artificial, automatizaciones y las herramientas que ya usa tu equipo para que cada tarea tenga un próximo paso claro.</p><a className="text-link" href="#metodo">Ver cómo lo hacemos <ArrowUpRight size={16} /></a></div>
    </section>

    <section className="section-shell services-section reveal"><div className="services-list">{services.map(([number, title, text], index) => <article className={`service-row reveal reveal-delay-${index + 1}`} key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><Workflow size={20} /></article>)}</div><div className="service-foot"><span>INTEGRAMOS CON TU ECOSISTEMA</span><div><b>WhatsApp</b><b>CRM</b><b>Google Sheets</b><b>n8n</b><b>APIs</b></div></div></section>

    <section id="casos" className="cases-section reveal"><div className="section-shell cases-intro"><span className="section-kicker">02 / CLIENTES</span><h2>Marcas que ya están<br /><span>trabajando con WIS.</span></h2><p>Una selección de empresas con las que desarrollamos soluciones a medida.</p></div><div ref={marqueeRef} className="brand-marquee reveal reveal-delay-1" aria-label="Clientes de WIS. Deslizá para recorrerlos"><div className="brand-marquee-track">{[0, 1].flatMap((copy) => caseBrands.map((brand) => <span className="brand-marquee-item" key={`${copy}-${brand}`}>{brand}<i>✦</i></span>))}</div></div></section>

    <section id="metodo" className="section-shell method-section reveal"><div className="method-head"><span className="section-kicker">03 / ENFOQUE</span><h2>Diagnóstico preciso.<br /><span>Implementación concreta.</span></h2></div><div className="method-steps reveal reveal-delay-1">{[['01', 'Entender', 'Mapeamos la operación y detectamos dónde se pierde tiempo.'], ['02', 'Diseñar', 'Definimos la solución más simple para resolverlo bien.'], ['03', 'Implementar', 'La ponemos en marcha junto a tu equipo.']].map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

    <section id="contacto" className="contact-section reveal"><div className="section-shell contact-grid"><div className="contact-copy"><span className="section-kicker">04 / CONTACTO</span><h2>Hablemos de tu<br />próximo sistema.</h2><p>Contanos cómo funciona hoy tu empresa y dónde querés ganar tiempo, orden o capacidad.</p><div className="contact-direct"><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><span className="whatsapp-mark"><MessageCircle size={14} /></span> WhatsApp directo <ArrowUpRight size={15} /></a><a href="mailto:ortu@wis-agency.com"><Mail size={17} /> ortu@wis-agency.com <ArrowUpRight size={15} /></a></div></div><form className="contact-form" onSubmit={submitContact}><div className="form-heading"><span>PRIMERA CONVERSACIÓN</span><b>Directa y sin compromiso.</b></div><label>Nombre<input name="name" required placeholder="Tu nombre" /></label><label>Empresa<input name="company" placeholder="Nombre de tu empresa" /></label><label>Email<input name="email" required type="email" placeholder="tu@email.com" /></label><label>¿Qué necesitás resolver?<textarea name="message" required rows={4} placeholder="Contanos brevemente qué querés mejorar..." /></label><button className="button button-primary" disabled={formStatus === 'sending'}>{formStatus === 'sending' ? 'Enviando...' : 'Enviar consulta'} <Send size={16} /></button>{formStatus === 'success' && <p className="form-success">Recibimos tu mensaje. Te vamos a responder pronto.</p>}{formStatus === 'error' && <p className="form-error">No pudimos enviarlo. Escribinos directo por WhatsApp.</p>}</form></div></section>

    <footer className="footer section-shell reveal"><div className="footer-brand"><BrandMark /><span>Work In Silence.</span></div><div className="footer-links"><a href="#que-hacemos">Qué hacemos</a><a href="#casos">Clientes</a><a href="#contacto">Contacto</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><span className="whatsapp-mark"><MessageCircle size={14} /></span> WhatsApp <ArrowUpRight size={14} /></a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={14} /></a></div><div className="footer-copy">© 2026 WIS Agency<br />Sistemas inteligentes · Argentina + LATAM</div></footer>
  </main>;
}
