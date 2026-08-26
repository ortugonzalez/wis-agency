'use client';

import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, Code2,
  Database, Gauge, Mail, Menu, MessageCircle, Send, Workflow, X,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

const WHATSAPP_URL = 'https://wa.me/5492235428861';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wis-backend.xbgh9n.easypanel.host/api';

const solutions = [
  { number: '01', icon: MessageCircle, title: 'Atención que responde', text: 'Agentes que contestan consultas, toman datos y avisan al equipo cuando hace falta.' },
  { number: '02', icon: Workflow, title: 'Procesos que siguen', text: 'Flujos que conectan WhatsApp, planillas, CRM y las herramientas que ya usás.' },
  { number: '03', icon: Database, title: 'Información en orden', text: 'Todo lo importante queda registrado para vender, decidir y trabajar con más claridad.' },
  { number: '04', icon: Code2, title: 'Sistemas a medida', text: 'Cuando una solución estándar no alcanza, construimos exactamente lo que tu operación necesita.' },
];

const cases = [
  { name: 'Quality Hard', logo: '/cases/qh-transparent.png', logoAlt: 'Quality Hard', url: 'https://www.qh.com.ar/', sector: 'Retail / ecommerce', title: 'Más orden para vender y atender mejor.', text: 'Ordenamos el ingreso de consultas y el seguimiento comercial para que cada oportunidad tenga un próximo paso.', bullets: ['Atención con contexto', 'Seguimiento comercial', 'Procesos conectados'] },
  { name: 'IMEPHO', logo: '/cases/imepho.webp', logoAlt: 'IMEPHO', url: 'https://imepho.com.ar/', sector: 'Construcción / retail', title: 'La información correcta, en el momento correcto.', text: 'Llevamos más contexto a la atención de una operación de productos para la construcción, desde la consulta hasta la derivación.', bullets: ['Ecommerce con contexto', 'Consultas organizadas', 'Trazabilidad operativa'] },
  { name: 'Movimientos Indumec', logo: '/cases/indumec.svg', logoAlt: 'Movimientos Indumec', url: 'https://movimientosindumec.com.ar/', sector: 'Automotriz / industrial', title: 'Un catálogo técnico que trabaja a favor del equipo.', text: 'Construimos un flujo más claro para un catálogo técnico, conectando consulta, asesoramiento y seguimiento.', bullets: ['Catálogo técnico', 'Derivación inteligente', 'Menos tareas manuales'] },
  { name: 'Metzeler Joyas', logoAlt: 'Metzeler Joyas', url: 'https://www.metzelerjoyas.ar/', sector: 'Joyería / ecommerce', title: 'Tecnología con el cuidado que exige una marca premium.', text: 'Diseñamos una atención más cuidada para acompañar decisiones de compra de alto valor sin perder velocidad.', bullets: ['Atención personalizada', 'Seguimiento de consultas', 'Experiencia de marca'] },
  { name: 'Dugas', logoAlt: 'Dugas S.R.L.', url: 'https://dugas.com.ar/', sector: 'Distribución', title: 'Una operación más ordenada para un negocio que no se detiene.', text: 'Acompañamos la coordinación de consultas y pedidos en una operación de distribución con cobertura regional.', bullets: ['Consultas centralizadas', 'Coordinación operativa', 'Seguimiento de pedidos'] },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`} aria-hidden="true"><Image src="/og-image.png" alt="" width={1200} height={630} priority={!compact} /></span>;
}

function CaseLogo({ item, large = false }: { item: typeof cases[number]; large?: boolean }) {
  return <span className={`case-logo ${large ? 'case-logo-large' : ''}`}>{item.logo ? <Image src={item.logo} alt={item.logoAlt} width={220} height={80} /> : <strong>{item.name}</strong>}</span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCase, setActiveCase] = useState(0);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const selectedCase = cases[activeCase];

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
    <div className="topline"><span className="pulse" /> WIS / automatización con IA para empresas <span className="topline-dot">·</span> Argentina + LATAM</div>

    <nav className="nav-shell">
      <a href="#inicio" className="brand" aria-label="WIS Agency, inicio"><BrandMark /></a>
      <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
        <a href="#que-hacemos" onClick={() => setMenuOpen(false)}>Qué hacemos</a>
        <a href="#casos" onClick={() => setMenuOpen(false)}>Casos</a>
        <a href="#metodo" onClick={() => setMenuOpen(false)}>Cómo trabajamos</a>
        <a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
      </div>
      <a className="nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Hablemos <ArrowUpRight size={15} /></a>
      <button className="menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
    </nav>

    <section id="inicio" className="hero section-shell">
      <div className="hero-copy">
        <div className="eyebrow"><span>WIS / 2026</span><span className="eyebrow-line" /><span>AUTOMATIZACIÓN + IA</span></div>
        <h1>Hacemos que tu negocio <em>avance solo.</em></h1>
        <p className="hero-lead">Diseñamos automatizaciones que conectan tus consultas, ventas y operación. Menos tareas manuales. Más tiempo para hacer crecer el negocio.</p>
        <div className="hero-actions"><a className="button button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Contanos qué querés mejorar <ArrowRight size={18} /></a><a className="button button-ghost" href="#casos">Ver casos reales <ArrowDownRight size={16} /></a></div>
        <div className="hero-note"><span className="hero-note-dot" /> Agentes · integraciones · flujos de trabajo</div>
      </div>

      <div className="hero-visual" aria-label="Animación continua de un sistema WIS">
        <div className="visual-grid" />
        <div className="visual-glow visual-glow-one" />
        <div className="visual-glow visual-glow-two" />
        <div className="visual-orbit visual-orbit-one" />
        <div className="visual-orbit visual-orbit-two" />
        <div className="visual-orbit visual-orbit-three" />
        <div className="visual-ribbon visual-ribbon-one" />
        <div className="visual-ribbon visual-ribbon-two" />
        <div className="visual-ribbon visual-ribbon-three" />
        <div className="visual-core"><span>WIS</span><small>WORK IN SILENCE</small></div>
        <div className="visual-node visual-node-one"><Gauge size={15} /><span>Detectar</span></div>
        <div className="visual-node visual-node-two"><MessageCircle size={15} /><span>Responder</span></div>
        <div className="visual-node visual-node-three"><Check size={15} /><span>Avanzar</span></div>
        <div className="visual-caption"><span>MOTION LOOP / 01</span><b>La operación, en movimiento.</b></div>
      </div>
    </section>

    <div className="hero-bottom section-shell"><span>01</span><p>Una capa de automatización sobre la forma en que ya trabajás.</p><span className="hero-scroll">Scroll <ArrowDownRight size={14} /></span></div>

    <section id="que-hacemos" className="section-shell section-padded work-section">
      <div className="section-heading"><div><span className="section-kicker">01 / QUÉ HACEMOS</span><h2>La tecnología tiene que <em>hacerte la vida más fácil.</em></h2></div><p>WIS ordena tareas repetitivas y conecta las partes de tu negocio que hoy trabajan separadas.</p></div>
      <div className="solutions-list">{solutions.map((solution) => { const Icon = solution.icon; return <article className="solution-row" key={solution.number}><span className="solution-number">{solution.number}</span><Icon size={22} /><div><h3>{solution.title}</h3><p>{solution.text}</p></div><ArrowUpRight className="solution-arrow" size={20} /></article>; })}</div>
      <div className="integration-line"><span>SE INTEGRA CON LO QUE YA USÁS</span><div><b>WhatsApp</b><b>Google Sheets</b><b>CRM</b><b>n8n</b><b>APIs</b></div></div>
    </section>

    <section id="casos" className="cases-section section-padded">
      <div className="section-shell"><div className="section-heading cases-heading"><div><span className="section-kicker">02 / CASOS REALES</span><h2>Lo que hacemos, <em>se nota.</em></h2></div><p>Una selección de empresas con las que trabajamos para mejorar atención, seguimiento y operación.</p></div></div>
      <div className="case-marquee" aria-label="Casos de éxito de WIS">
        <div className="case-marquee-track">{[0, 1].flatMap((copy) => cases.map((item, index) => <button className={`case-marquee-item ${activeCase === index ? 'is-active' : ''}`} key={`${copy}-${item.name}`} onClick={() => setActiveCase(index)} aria-label={`Ver caso ${item.name}`}><CaseLogo item={item} /><span className="case-mark">✦</span></button>))}</div>
      </div>
      <div className="section-shell"><div className="case-story" key={selectedCase.name}><div className="case-story-index">0{activeCase + 1}<span> / 0{cases.length}</span></div><div className="case-story-main"><div className="case-story-top"><CaseLogo item={selectedCase} large /><span>{selectedCase.sector}</span></div><h3>{selectedCase.title}</h3><p>{selectedCase.text}</p><div className="case-details">{selectedCase.bullets.map((detail) => <span key={detail}><Check size={14} />{detail}</span>)}</div></div><a className="case-story-link" href={selectedCase.url} target="_blank" rel="noreferrer">Ver sitio <ArrowUpRight size={16} /></a></div></div>
    </section>

    <section id="metodo" className="section-shell section-padded method-section"><div className="section-heading"><div><span className="section-kicker">03 / CÓMO TRABAJAMOS</span><h2>Primero entendemos.<br /><em>Después construimos.</em></h2></div><p>La herramienta es lo último. Primero encontramos qué está frenando a tu equipo y dónde una mejora puede mover la aguja.</p></div><div className="method-line">{[['01', 'Miramos', 'Entendemos tu operación y detectamos la fricción real.'], ['02', 'Diseñamos', 'Armamos una solución simple, medible y posible de mantener.'], ['03', 'Activamos', 'Implementamos con tu equipo y mejoramos sobre la marcha.']].map(([number, title, text]) => <article className="method-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div><p className="method-signature">WIS / Work In Silence</p></section>

    <section id="contacto" className="contact-section"><div className="section-shell contact-grid"><div className="contact-copy"><span className="section-kicker">04 / HABLEMOS</span><h2>¿Qué parte de tu negocio te está haciendo perder tiempo?</h2><p>Contanos cómo trabajan hoy. Te respondemos con una mirada concreta y un próximo paso posible.</p><div className="contact-direct"><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp directo <ArrowUpRight size={15} /></a><a href="mailto:ortu@wis-agency.com"><Mail size={17} /> ortu@wis-agency.com <ArrowUpRight size={15} /></a></div></div><form className="contact-form" onSubmit={submitContact}><div className="form-heading"><span>DIAGNÓSTICO INICIAL</span><b>Sin humo. Sin compromiso.</b></div><label>Nombre<input name="name" required placeholder="Tu nombre" /></label><label>Empresa<input name="company" placeholder="Nombre de tu empresa" /></label><label>Email<input name="email" required type="email" placeholder="tu@email.com" /></label><label>¿Qué te gustaría mejorar?<textarea name="message" required rows={4} placeholder="Ej: perdemos consultas porque nadie hace el seguimiento..." /></label><button className="button button-primary" disabled={formStatus === 'sending'}>{formStatus === 'sending' ? 'Enviando...' : 'Enviar mensaje'} <Send size={16} /></button>{formStatus === 'success' && <p className="form-success">Recibimos tu mensaje. Te vamos a responder pronto.</p>}{formStatus === 'error' && <p className="form-error">No pudimos enviarlo. Escribinos directo por WhatsApp.</p>}</form></div></section>

    <footer className="footer section-shell"><div className="footer-brand"><BrandMark compact /><span>Work In Silence.</span></div><div className="footer-links"><a href="#que-hacemos">Qué hacemos</a><a href="#casos">Casos</a><a href="#contacto">Contacto</a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={14} /></a></div><div className="footer-copy">© 2026 WIS Agency<br />Automatización con IA · Argentina + LATAM</div></footer>
  </main>;
}
