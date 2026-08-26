'use client';

import { ArrowDown, ArrowRight, ArrowUpRight, Mail, Menu, MessageCircle, Send, Workflow, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

const WHATSAPP_URL = 'https://wa.me/5492235428861';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wis-backend.xbgh9n.easypanel.host/api';

const services = [
  ['01', 'Atención', 'Agentes que responden, califican y derivan cada consulta.'],
  ['02', 'Seguimiento', 'Flujos que hacen que ninguna oportunidad quede olvidada.'],
  ['03', 'Operación', 'Integraciones que sacan trabajo repetitivo del medio.'],
];

const caseBrands = ['Quality Hard', 'IMEPHO', 'Movimientos Indumec', 'Metzeler Joyas', 'Dugas'];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><Image src="/logo-transparent.png" alt="" fill sizes="76px" priority /></span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

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
    <div className="topline"><span className="topline-dot" /> WIS / automatización con IA para empresas <span className="topline-separator">·</span> Argentina + LATAM</div>

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
        <h1>Automatizamos<br /><span>lo que te frena.</span></h1>
        <p>Atención, ventas y operación conectadas para que tu empresa funcione mejor todos los días.</p>
        <div className="hero-actions"><a className="button button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Quiero automatizar mi negocio <ArrowRight size={18} /></a><a className="button button-ghost" href="#que-hacemos">Conocé WIS <ArrowDown size={16} /></a></div>
      </div>
      <div className="hero-film-meta"><span>MOTION LOOP / 01</span><span>IA · INTEGRACIONES · PROCESOS</span></div>
      <a className="hero-film-scroll" href="#que-hacemos" aria-label="Bajar a qué hacemos"><span>Scroll</span><ArrowDown size={15} /></a>
    </section>

    <section id="que-hacemos" className="section-shell intro-section">
      <div className="intro-copy"><span className="section-kicker">01 / QUÉ HACEMOS</span><h2>Tu equipo no necesita hacer más.<br /><span>Necesita hacer mejor.</span></h2></div>
      <div className="intro-side"><p>WIS diseña automatizaciones con IA para que las consultas se atiendan, los datos circulen y los procesos sigan avanzando sin depender de una sola persona.</p><a className="text-link" href="#contacto">Hablemos de tu operación <ArrowUpRight size={16} /></a></div>
    </section>

    <section className="section-shell services-section"><div className="services-list">{services.map(([number, title, text]) => <article className="service-row" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><Workflow size={20} /></article>)}</div><div className="service-foot"><span>SE CONECTA CON LO QUE YA USÁS</span><div><b>WhatsApp</b><b>CRM</b><b>Google Sheets</b><b>n8n</b><b>APIs</b></div></div></section>

    <section id="casos" className="cases-section"><div className="section-shell cases-intro"><span className="section-kicker">02 / CASOS DE TRABAJO</span><h2>Empresas que eligieron<br /><span>moverse distinto.</span></h2><p>Una línea de marcas con las que trabajamos.</p></div><div className="brand-marquee" aria-label="Casos de trabajo de WIS"><div className="brand-marquee-track">{[0, 1].flatMap((copy) => caseBrands.map((brand) => <span className="brand-marquee-item" key={`${copy}-${brand}`}>{brand}<i>✦</i></span>))}</div></div></section>

    <section className="section-shell method-section"><div className="method-head"><span className="section-kicker">03 / EL MÉTODO</span><h2>Primero entendemos.<br /><span>Después automatizamos.</span></h2></div><div className="method-steps">{[['01', 'Miramos', 'Dónde se va el tiempo.'], ['02', 'Diseñamos', 'Qué puede empezar a resolverse solo.'], ['03', 'Activamos', 'Una mejora real, con tu equipo.']].map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section id="contacto" className="contact-section"><div className="section-shell contact-grid"><div className="contact-copy"><span className="section-kicker">04 / HABLEMOS</span><h2>¿Qué parte de tu negocio te está frenando?</h2><p>Contanos cómo trabajan hoy. Te respondemos con un próximo paso posible.</p><div className="contact-direct"><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp directo <ArrowUpRight size={15} /></a><a href="mailto:ortu@wis-agency.com"><Mail size={17} /> ortu@wis-agency.com <ArrowUpRight size={15} /></a></div></div><form className="contact-form" onSubmit={submitContact}><div className="form-heading"><span>DIAGNÓSTICO INICIAL</span><b>Sin humo. Sin compromiso.</b></div><label>Nombre<input name="name" required placeholder="Tu nombre" /></label><label>Empresa<input name="company" placeholder="Nombre de tu empresa" /></label><label>Email<input name="email" required type="email" placeholder="tu@email.com" /></label><label>¿Qué te gustaría mejorar?<textarea name="message" required rows={4} placeholder="Ej: perdemos consultas porque nadie hace el seguimiento..." /></label><button className="button button-primary" disabled={formStatus === 'sending'}>{formStatus === 'sending' ? 'Enviando...' : 'Enviar mensaje'} <Send size={16} /></button>{formStatus === 'success' && <p className="form-success">Recibimos tu mensaje. Te vamos a responder pronto.</p>}{formStatus === 'error' && <p className="form-error">No pudimos enviarlo. Escribinos directo por WhatsApp.</p>}</form></div></section>

    <footer className="footer section-shell"><div className="footer-brand"><BrandMark /><span>Work In Silence.</span></div><div className="footer-links"><a href="#que-hacemos">Qué hacemos</a><a href="#casos">Casos</a><a href="#contacto">Contacto</a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={14} /></a></div><div className="footer-copy">© 2026 WIS Agency<br />Automatización con IA · Argentina + LATAM</div></footer>
  </main>;
}
