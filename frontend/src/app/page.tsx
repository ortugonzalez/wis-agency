'use client';

import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, CircleDollarSign, Clock3, Code2,
  Database, Gauge, Layers3, Mail, Menu, MessageCircle, Send, ShieldCheck,
  Sparkles, Target, Workflow, X,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

const WHATSAPP_URL = 'https://wa.me/5492235428861';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wis-backend.xbgh9n.easypanel.host/api';

const solutions = [
  { number: '01', icon: MessageCircle, title: 'Atención que no se enfría', text: 'Agentes que responden, califican oportunidades y derivan a tu equipo con todo el contexto.', tags: ['WhatsApp', 'Web', 'CRM'] },
  { number: '02', icon: Workflow, title: 'Workflows que ejecutan', text: 'Conectamos tus herramientas para que los datos fluyan sin copiar, pegar ni perseguir pendientes.', tags: ['n8n', 'APIs', 'Automatización'] },
  { number: '03', icon: Database, title: 'Operaciones con contexto', text: 'Centralizamos información, documentos y reglas para decidir más rápido y con menos errores.', tags: ['OCR', 'Datos', 'Dashboards'] },
  { number: '04', icon: Code2, title: 'Sistemas a medida', text: 'Cuando una herramienta genérica no alcanza, construimos la capa digital que tu negocio necesita.', tags: ['MVP', 'Integraciones', 'Escala'] },
];

const cases = [
  {
    name: 'Quality Hard', logo: '/cases/qh.png', logoAlt: 'Quality Hard', url: 'https://www.qh.com.ar/',
    sector: 'Retail / ecommerce', title: 'Más orden para vender y atender mejor.',
    text: 'Diseñamos una operación más clara para que las consultas, el catálogo y el seguimiento comercial no dependan de respuestas dispersas.',
    bullets: ['Atención con contexto', 'Seguimiento comercial', 'Procesos conectados'],
  },
  {
    name: 'IMEPHO', logo: '/cases/imepho.webp', logoAlt: 'IMEPHO', url: 'https://imepho.com.ar/',
    sector: 'Construcción / retail', title: 'La información correcta, en el momento correcto.',
    text: 'Acompañamos una operación de productos para la construcción con sistemas que ordenan consultas, información y próximos pasos.',
    bullets: ['Ecommerce con contexto', 'Consultas organizadas', 'Trazabilidad operativa'],
  },
  {
    name: 'Movimientos Indumec', logo: '/cases/indumec.png', logoAlt: 'Movimientos Indumec', url: 'https://movimientosindumec.com.ar/',
    sector: 'Automotriz / industrial', title: 'Un catálogo técnico que trabaja a favor del equipo.',
    text: 'Conectamos atención y operación para que una consulta técnica avance con claridad, velocidad y la información necesaria.',
    bullets: ['Catálogo técnico', 'Derivación inteligente', 'Menos tareas manuales'],
  },
  {
    name: 'Metzeler Joyas', logoAlt: 'Metzeler Joyas', url: 'https://www.metzelerjoyas.ar/',
    sector: 'Joyería / ecommerce', title: 'Tecnología con el cuidado que exige una marca premium.',
    text: 'Trabajamos sobre una experiencia de atención más fluida para responder con velocidad sin perder el tono personal de la marca.',
    bullets: ['Atención personalizada', 'Seguimiento de consultas', 'Experiencia de marca'],
  },
  {
    name: 'Dugas', logoAlt: 'Dugas S.R.L.', url: 'https://dugas.com.ar/',
    sector: 'Distribución', title: 'Una operación más ordenada para un negocio que no se detiene.',
    text: 'Dugas forma parte de los casos que trabajamos para llevar más orden a las consultas, la coordinación y el seguimiento del día a día.',
    bullets: ['Consultas centralizadas', 'Coordinación operativa', 'Seguimiento de pedidos'],
  },
];

const faqs = [
  ['¿Qué tipo de empresas trabajan con WIS?', 'Trabajamos con PyMEs y equipos en crecimiento que ya tienen clientes, herramientas y procesos, pero sienten que la operación depende demasiado de tareas manuales.'],
  ['¿Tengo que cambiar todas mis herramientas?', 'No. Partimos de lo que ya usás y conectamos las piezas que tienen sentido. La tecnología queda al servicio del proceso, no al revés.'],
  ['¿Cuánto tarda una implementación?', 'Un primer piloto suele estar listo entre 2 y 4 semanas, según el alcance y la cantidad de integraciones. Priorizamos una mejora concreta antes de construir algo más grande.'],
  ['¿La IA reemplaza a mi equipo?', 'La usamos para sacar trabajo repetitivo del camino. Las conversaciones sensibles, las decisiones y el criterio siguen en manos de tu equipo.'],
  ['¿Cómo sé si vale la pena automatizar?', 'En el diagnóstico medimos frecuencia, tiempo, errores y costo de cada tarea. Si no hay un impacto claro, te lo decimos antes de proponer una implementación.'],
];

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`} aria-hidden="true"><Image src="/og-image.png" alt="" width={1200} height={630} priority={!compact} /></span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'success'>('idle');

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormStatus('sending');
    const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
    try { const response = await fetch(`${API_URL}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) throw new Error('contact-failed'); setFormStatus('success'); event.currentTarget.reset(); } catch { setFormStatus('error'); }
  }

  async function submitNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const email = String(form.get('email') || ''); if (!email) return;
    try { await fetch(`${API_URL}/newsletter`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); } finally { setNewsletterStatus('success'); event.currentTarget.reset(); }
  }

  return (
    <main>
      <div className="topline"><span className="pulse" /> WIS / sistemas que trabajan en silencio <span className="topline-dot">·</span> Argentina + LATAM</div>
      <nav className="nav-shell">
        <a href="#inicio" className="brand" aria-label="WIS Agency, inicio"><BrandMark /></a>
        <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
          <a href="#problema" onClick={() => setMenuOpen(false)}>El problema</a><a href="#soluciones" onClick={() => setMenuOpen(false)}>Soluciones</a><a href="#casos" onClick={() => setMenuOpen(false)}>Casos</a><a href="#metodo" onClick={() => setMenuOpen(false)}>Método</a><a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
        </div>
        <a className="nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Agendar diagnóstico <ArrowUpRight size={15} /></a>
        <button className="menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </nav>

      <section id="inicio" className="hero section-shell">
        <div className="hero-copy"><div className="eyebrow"><span>WIS / 2026</span><span className="eyebrow-line" /><span>OPERATING SYSTEMS</span></div><h1>La operación de tu empresa, <em>trabajando a favor.</em></h1><p className="hero-lead">Diseñamos agentes, integraciones y sistemas que sacan el trabajo repetitivo del medio para que tu equipo pueda vender, decidir y crecer con más calma.</p><div className="hero-actions"><a className="button button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Ordenar mi operación <ArrowRight size={18} /></a><a className="button button-ghost" href="#casos">Ver casos <ArrowUpRight size={16} /></a></div><div className="hero-note"><ShieldCheck size={16} /> Diagnóstico claro antes de construir nada</div></div>
        <div className="hero-visual" aria-label="Sistema WIS para coordinar una operación"><div className="visual-halo" /><div className="signal-panel"><div className="panel-top"><span><i /><i /><i /></span><small>WIS / LIVE SYSTEM</small><b><span /> ONLINE</b></div><div className="panel-title"><span>Una capa inteligente<br />sobre tu operación.</span><strong>01</strong></div><div className="system-flow"><div className="flow-node is-active"><MessageCircle size={17} /><span>Entrada</span><b>WhatsApp / Web</b></div><div className="flow-connector"><i /><i /><i /></div><div className="flow-node"><Target size={17} /><span>Contexto</span><b>IA + reglas</b></div><div className="flow-connector"><i /><i /><i /></div><div className="flow-node"><Gauge size={17} /><span>Acción</span><b>Equipo + CRM</b></div></div><div className="panel-footer"><span><b>WIS</b> / work in silence</span><span>Proceso visible. Resultado medible.</span></div></div><div className="visual-tag visual-tag-one"><span>01</span><b>Escuchar</b><small>capturamos cada señal</small></div><div className="visual-tag visual-tag-two"><span>02</span><b>Resolver</b><small>activamos el próximo paso</small></div></div>
      </section>

      <section className="proof-strip section-shell" aria-label="Lo que buscamos mejorar"><div><strong>Más claridad</strong><span>en cada conversación<br />y cada proceso</span></div><div><strong>Menos fricción</strong><span>entre tus herramientas,<br />tu equipo y tus clientes</span></div><div><strong>Más tiempo</strong><span>para el trabajo que<br />realmente mueve el negocio</span></div><div className="proof-side"><span className="proof-label">LA IDEA WIS</span><span>que la tecnología haga su parte</span></div></section>

      <section id="problema" className="section-shell section-padded problem-section"><Reveal className="section-heading split-heading"><div><span className="section-kicker">01 / EL PROBLEMA</span><h2>Lo que frena a tu negocio no siempre es vender más.</h2></div><p>Muchas empresas ya tienen clientes, equipo y herramientas. Lo que no tienen es un sistema que conecte todo. Ahí aparecen las horas perdidas, los leads que nadie sigue y las decisiones tomadas a ciegas.</p></Reveal><div className="problem-grid">{[[Clock3, 'Horas que desaparecen', 'Tu equipo copia datos entre WhatsApp, planillas, mails y sistemas que no se hablan.'], [CircleDollarSign, 'Oportunidades que se enfrían', 'Una consulta sin respuesta rápida o un seguimiento olvidado puede costar una venta.'], [Layers3, 'Información que no llega', 'Cada persona tiene una parte del contexto y nadie ve la operación completa.']].map(([Icon, title, text]) => { const CardIcon = Icon as typeof Clock3; return <Reveal key={String(title)}><article className="problem-card"><CardIcon size={22} /><h3>{String(title)}</h3><p>{String(text)}</p><span className="card-arrow">↘</span></article></Reveal>; })}</div></section>

      <section id="soluciones" className="section-shell section-padded solutions-section"><Reveal className="section-heading split-heading"><div><span className="section-kicker">02 / LO QUE CONSTRUIMOS</span><h2>Menos tareas sueltas.<br /><span>Más sistema.</span></h2></div><p>No vendemos una herramienta más. Entendemos cómo funciona tu negocio, encontramos el cuello de botella y construimos la automatización que tiene sentido para vos.</p></Reveal><div className="solutions-grid">{solutions.map((solution) => { const Icon = solution.icon; return <Reveal key={solution.number}><article className="solution-card"><div className="solution-card-top"><span className="solution-number">{solution.number}</span><Icon size={22} /></div><h3>{solution.title}</h3><p>{solution.text}</p><div className="tag-row">{solution.tags.map(tag => <span key={tag}>{tag}</span>)}</div><a href="#contacto" aria-label={`Consultar por ${solution.title}`}><ArrowUpRight size={18} /></a></article></Reveal>; })}</div><div className="integration-line"><span>SE INTEGRA CON LO QUE YA USÁS</span><div><b>WhatsApp</b><b>Google Sheets</b><b>CRM</b><b>n8n</b><b>APIs</b><b>+ lo que haga falta</b></div></div></section>

      <section id="casos" className="section-shell section-padded cases-section"><Reveal className="section-heading split-heading"><div><span className="section-kicker">03 / CASOS DE ÉXITO</span><h2>Cuando el sistema mejora,<br /><span>el negocio se siente.</span></h2></div><p>Cada caso empieza en un problema concreto y termina en una operación más clara. Estos son los equipos con los que venimos construyendo esa mejora.</p></Reveal><div className="case-logos" aria-label="Clientes de WIS">{cases.map(item => <a key={item.name} href={item.url} target="_blank" rel="noreferrer" className="case-logo"><span className="case-logo-media">{item.logo ? <Image src={item.logo} alt={item.logoAlt} width={180} height={70} /> : <strong>{item.name}</strong>}</span><span>{item.name}</span><ArrowUpRight size={13} /></a>)}</div><div className="cases-list">{cases.map((item, index) => <Reveal key={item.name}><article className="case-card"><div className="case-index">0{index + 1}</div><div className="case-main"><div className="case-heading"><span className="case-logo-media case-logo-media-card">{item.logo ? <Image src={item.logo} alt={item.logoAlt} width={190} height={70} /> : <strong>{item.name}</strong>}</span><div><span className="case-label">{item.sector}</span><h3>{item.title}</h3></div></div><p>{item.text}</p><div className="case-details">{item.bullets.map(detail => <span key={detail}><Check size={14} />{detail}</span>)}</div></div><a className="case-link" href={item.url} target="_blank" rel="noreferrer">Ver sitio <ArrowUpRight size={17} /></a></article></Reveal>)}</div><div className="case-disclaimer"><Sparkles size={15} /> Los casos se presentan por el tipo de mejora trabajada. Las métricas se validan con cada equipo antes y después de implementar.</div></section>

      <section id="metodo" className="section-padded method-section"><div className="section-shell"><Reveal className="section-heading split-heading"><div><span className="section-kicker">04 / EL MÉTODO WIS</span><h2>Primero entendemos.<br /><span>Después automatizamos.</span></h2></div><p>La tecnología cambia rápido. El problema de tu negocio merece una solución pensada, medible y mantenible.</p></Reveal><div className="method-grid">{[['01', 'Entendemos', 'Mapeamos tu operación, detectamos fricciones y elegimos el proceso con mayor impacto.'], ['02', 'Diseñamos', 'Definimos reglas, integraciones y una primera versión que tu equipo pueda probar rápido.'], ['03', 'Construimos', 'Implementamos, medimos y mejoramos. Sin entregarte un proyecto para que después lo mantengas solo.']].map(([number, title, text], index) => <Reveal key={number}><div className="method-step"><span>{number}</span><div className="method-line"><i /></div><h3>{title}</h3><p>{text}</p>{index === 2 && <a href="#contacto">Empezar diagnóstico <ArrowRight size={15} /></a>}</div></Reveal>)}</div><div className="quote-card"><div className="quote-mark">“</div><blockquote>No vendemos IA. Devolvemos tiempo, contexto y capacidad de decisión.</blockquote><span>— WIS / Work In Silence</span></div></div></section>

      <section className="section-shell section-padded fit-section"><Reveal className="section-heading"><span className="section-kicker">05 / PARA QUIÉN</span><h2>Si tu negocio crece,<br /><span>tu operación también tiene que hacerlo.</span></h2></Reveal><div className="fit-layout"><div className="fit-copy"><p>WIS es para equipos que quieren dejar de depender de héroes operativos, chats eternos y planillas que solo entiende una persona.</p><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-link">Contanos qué te está trabando <ArrowUpRight size={17} /></a></div><div className="fit-chips"><span>Retail</span><span>Salud</span><span>Inmobiliarias</span><span>Concesionarias</span><span>Servicios B2B</span><span>Educación</span><span>Estudios profesionales</span><span>Equipos comerciales</span></div></div></section>

      <section className="section-shell section-padded faq-section" id="faq"><Reveal className="section-heading split-heading"><div><span className="section-kicker">06 / PREGUNTAS FRECUENTES</span><h2>Antes de empezar,<br /><span>hablemos claro.</span></h2></div><p>Si la automatización no resuelve un problema real, es solo otra cosa que mantener. Por eso hacemos estas preguntas antes de construir.</p></Reveal><div className="faq-list">{faqs.map(([question, answer], index) => <Reveal key={question}><div className={`faq-item ${openFaq === index ? 'is-open' : ''}`}><button onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}><span>{question}</span><ChevronDown size={18} /></button>{openFaq === index && <p>{answer}</p>}</div></Reveal>)}</div></section>

      <section id="contacto" className="contact-section"><div className="section-shell contact-grid"><Reveal><span className="section-kicker">07 / HABLEMOS</span><h2>El próximo cuello de botella puede ser la próxima mejora.</h2><p>Contanos qué parte de tu operación te está sacando tiempo. Te respondemos con una mirada concreta, aunque todavía no estés listo para implementar.</p><div className="contact-direct"><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp directo <ArrowUpRight size={15} /></a><a href="mailto:ortu@wis-agency.com"><Mail size={17} /> ortu@wis-agency.com <ArrowUpRight size={15} /></a></div></Reveal><Reveal><form className="contact-form" onSubmit={submitContact}><div className="form-heading"><span>DIAGNÓSTICO INICIAL</span><b>Sin humo. Sin compromiso.</b></div><label>Nombre<input name="name" required placeholder="Tu nombre" /></label><label>Empresa<input name="company" placeholder="Nombre de tu empresa" /></label><label>Email<input name="email" required type="email" placeholder="tu@email.com" /></label><label>¿Qué te gustaría mejorar?<textarea name="message" required rows={4} placeholder="Ej: perdemos leads porque nadie hace el seguimiento..." /></label><button className="button button-primary" disabled={formStatus === 'sending'}>{formStatus === 'sending' ? 'Enviando...' : 'Enviar diagnóstico'} <Send size={16} /></button>{formStatus === 'success' && <p className="form-success">Recibimos tu mensaje. Te vamos a responder pronto.</p>}{formStatus === 'error' && <p className="form-error">No pudimos enviar el mensaje. Escribinos directo por WhatsApp.</p>}</form></Reveal></div></section>

      <section className="section-shell newsletter-section"><div><span className="section-kicker">WIS / SIGNAL</span><h3>Ideas prácticas para automatizar mejor.</h3><p>Una vez por mes: casos, aprendizajes y herramientas para hacer crecer tu operación.</p></div>{newsletterStatus === 'success' ? <div className="newsletter-success"><Check size={17} /> Listo. Te avisamos cuando salga el próximo.</div> : <form onSubmit={submitNewsletter}><input name="email" type="email" required placeholder="tu@email.com" aria-label="Tu email" /><button aria-label="Suscribirme"><ArrowRight size={18} /></button></form>}</section>
      <footer className="footer section-shell"><div className="footer-brand"><BrandMark compact /><span>Work In Silence.</span></div><div className="footer-links"><a href="#soluciones">Soluciones</a><a href="#casos">Casos</a><a href="#faq">FAQ</a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={14} /></a></div><div className="footer-copy">© 2026 WIS Agency<br />Automatización con IA · Argentina + LATAM</div></footer>
    </main>
  );
}
