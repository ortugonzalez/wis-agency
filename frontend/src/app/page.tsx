'use client';

import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Code2,
  Database, Gauge, Mail, Menu, MessageCircle, Send, ShieldCheck, Sparkles,
  Target, Workflow, X,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const WHATSAPP_URL = 'https://wa.me/5492235428861';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wis-backend.xbgh9n.easypanel.host/api';

const solutions = [
  { number: '01', icon: MessageCircle, title: 'Atención', text: 'Agentes que escuchan, entienden y llevan cada conversación hacia el próximo paso.' },
  { number: '02', icon: Workflow, title: 'Automatización', text: 'Flujos que conectan las herramientas que ya usás y hacen avanzar la operación solos.' },
  { number: '03', icon: Database, title: 'Contexto', text: 'Información ordenada para que las decisiones no dependan de perseguir datos.' },
  { number: '04', icon: Code2, title: 'Sistemas', text: 'La capa digital propia que aparece cuando una solución estándar se queda corta.' },
];

const cases = [
  { name: 'Quality Hard', logo: '/cases/qh.png', logoAlt: 'Quality Hard', url: 'https://www.qh.com.ar/', sector: 'Retail / ecommerce', title: 'Más orden para vender y atender mejor.', text: 'Diseñamos una operación más clara para que las consultas, el catálogo y el seguimiento comercial no dependan de respuestas dispersas.', bullets: ['Atención con contexto', 'Seguimiento comercial', 'Procesos conectados'] },
  { name: 'IMEPHO', logo: '/cases/imepho.webp', logoAlt: 'IMEPHO', url: 'https://imepho.com.ar/', sector: 'Construcción / retail', title: 'La información correcta, en el momento correcto.', text: 'Acompañamos una operación de productos para la construcción con sistemas que ordenan consultas, información y próximos pasos.', bullets: ['Ecommerce con contexto', 'Consultas organizadas', 'Trazabilidad operativa'] },
  { name: 'Movimientos Indumec', logo: '/cases/indumec.png', logoAlt: 'Movimientos Indumec', url: 'https://movimientosindumec.com.ar/', sector: 'Automotriz / industrial', title: 'Un catálogo técnico que trabaja a favor del equipo.', text: 'Conectamos atención y operación para que una consulta técnica avance con claridad, velocidad y la información necesaria.', bullets: ['Catálogo técnico', 'Derivación inteligente', 'Menos tareas manuales'] },
  { name: 'Metzeler Joyas', logoAlt: 'Metzeler Joyas', url: 'https://www.metzelerjoyas.ar/', sector: 'Joyería / ecommerce', title: 'Tecnología con el cuidado que exige una marca premium.', text: 'Trabajamos sobre una experiencia de atención más fluida para responder con velocidad sin perder el tono personal de la marca.', bullets: ['Atención personalizada', 'Seguimiento de consultas', 'Experiencia de marca'] },
  { name: 'Dugas', logoAlt: 'Dugas S.R.L.', url: 'https://dugas.com.ar/', sector: 'Distribución', title: 'Una operación más ordenada para un negocio que no se detiene.', text: 'Dugas forma parte de los casos que trabajamos para llevar más orden a las consultas, la coordinación y el seguimiento del día a día.', bullets: ['Consultas centralizadas', 'Coordinación operativa', 'Seguimiento de pedidos'] },
];

const faqs = [
  ['¿Qué tipo de empresas trabajan con WIS?', 'Trabajamos con PyMEs y equipos en crecimiento que ya tienen clientes, herramientas y procesos, pero sienten que la operación depende demasiado de tareas manuales.'],
  ['¿Tengo que cambiar todas mis herramientas?', 'No. Partimos de lo que ya usás y conectamos las piezas que tienen sentido. La tecnología queda al servicio del proceso, no al revés.'],
  ['¿Cuánto tarda una implementación?', 'Un primer piloto suele estar listo entre 2 y 4 semanas, según el alcance y la cantidad de integraciones.'],
  ['¿La IA reemplaza a mi equipo?', 'La usamos para sacar trabajo repetitivo del camino. Las conversaciones sensibles, las decisiones y el criterio siguen en manos de tu equipo.'],
];

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`} aria-hidden="true"><Image src="/og-image.png" alt="" width={1200} height={630} priority={!compact} /></span>;
}

function CaseLogo({ item, large = false }: { item: typeof cases[number]; large?: boolean }) {
  return <span className={`case-logo-media ${large ? 'case-logo-media-large' : ''}`}>{item.logo ? <Image src={item.logo} alt={item.logoAlt} width={220} height={80} /> : <strong>{item.name}</strong>}</span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeCase, setActiveCase] = useState(0);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    const root = document.documentElement;
    const onScroll = () => root.style.setProperty('--scroll-y', `${window.scrollY}px`);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function moveStage(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--pointer-x', `${((event.clientX - rect.left) / rect.width - .5) * 2}`);
    event.currentTarget.style.setProperty('--pointer-y', `${((event.clientY - rect.top) / rect.height - .5) * 2}`);
  }

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormStatus('sending');
    const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries());
    try { const response = await fetch(`${API_URL}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) throw new Error('contact-failed'); setFormStatus('success'); event.currentTarget.reset(); } catch { setFormStatus('error'); }
  }

  async function submitNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const email = String(form.get('email') || ''); if (!email) return;
    try { await fetch(`${API_URL}/newsletter`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); } finally { setNewsletterStatus('success'); event.currentTarget.reset(); }
  }

  const selectedCase = cases[activeCase];

  return <main>
    <div className="topline"><span className="pulse" /> WIS / sistemas que trabajan en silencio <span className="topline-dot">·</span> Argentina + LATAM</div>
    <nav className="nav-shell"><a href="#inicio" className="brand" aria-label="WIS Agency, inicio"><BrandMark /></a><div className={`nav-links ${menuOpen ? 'is-open' : ''}`}><a href="#idea" onClick={() => setMenuOpen(false)}>La idea</a><a href="#soluciones" onClick={() => setMenuOpen(false)}>Lo que hacemos</a><a href="#casos" onClick={() => setMenuOpen(false)}>Casos</a><a href="#metodo" onClick={() => setMenuOpen(false)}>Método</a><a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a></div><a className="nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Agendar diagnóstico <ArrowUpRight size={15} /></a><button className="menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></nav>

    <section id="inicio" className="hero section-shell"><div className="hero-copy"><div className="eyebrow"><span>WIS / 2026</span><span className="eyebrow-line" /><span>OPERATING SYSTEMS</span></div><h1>La operación de tu empresa, <em>en movimiento.</em></h1><p className="hero-lead">Diseñamos agentes, integraciones y sistemas que hacen que el trabajo avance, incluso cuando nadie está empujándolo.</p><div className="hero-actions"><a className="button button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Ordenar mi operación <ArrowRight size={18} /></a><a className="button button-ghost" href="#casos">Explorar casos <ArrowUpRight size={16} /></a></div><div className="hero-note"><ShieldCheck size={16} /> Diagnóstico claro antes de construir nada</div></div><div className="hero-stage" onMouseMove={moveStage} onMouseLeave={(event) => { event.currentTarget.style.setProperty('--pointer-x', '0'); event.currentTarget.style.setProperty('--pointer-y', '0'); }}><svg className="stage-lines" viewBox="0 0 600 560" fill="none" aria-hidden="true"><path className="stage-path stage-path-one" d="M42 276C132 276 139 105 253 105C367 105 344 386 474 386C524 386 548 345 566 293" /><path className="stage-path stage-path-two" d="M13 428C132 428 158 187 266 187C377 187 393 478 590 115" /><path className="stage-path stage-path-three" d="M88 67C182 67 202 315 326 315C445 315 441 219 560 219" /></svg><div className="stage-orbit stage-orbit-one" /><div className="stage-orbit stage-orbit-two" /><div className="stage-core"><BrandMark compact /><span>WIS</span><small>WORK IN SILENCE</small></div><div className="stage-node node-one"><MessageCircle size={16} /><b>Escuchar</b><small>cada señal importa</small></div><div className="stage-node node-two"><Target size={16} /><b>Entender</b><small>IA + criterio</small></div><div className="stage-node node-three"><Gauge size={16} /><b>Actuar</b><small>el próximo paso</small></div><div className="stage-caption"><span>01</span><p>Una capa inteligente<br />sobre tu operación.</p></div></div></section>

    <section className="ticker"><div className="ticker-track"><span>ATENCIÓN</span><i>✦</i><span>INTEGRACIONES</span><i>✦</i><span>CONTEXTO</span><i>✦</i><span>SISTEMAS A MEDIDA</span><i>✦</i><span>ATENCIÓN</span><i>✦</i><span>INTEGRACIONES</span><i>✦</i><span>CONTEXTO</span><i>✦</i></div></section>

    <section id="idea" className="section-shell manifesto"><Reveal><span className="section-kicker">01 / LA IDEA</span><p className="manifesto-lead">Tu negocio no necesita otra herramienta.<br /><em>Necesita que todo empiece a conversar.</em></p><div className="manifesto-foot"><span>WIS / Work In Silence</span><p>Cuando cada dato encuentra su lugar, tu equipo recupera algo más valioso que tiempo: capacidad de decidir.</p></div></Reveal></section>

    <section id="soluciones" className="section-shell section-padded solutions-section"><Reveal className="section-heading split-heading"><div><span className="section-kicker">02 / LO QUE HACEMOS</span><h2>Convertimos fricción<br /><span>en flujo.</span></h2></div><p>No vendemos una herramienta más. Entendemos cómo funciona tu negocio y construimos la capa que hace que todo se mueva mejor.</p></Reveal><div className="solutions-list">{solutions.map((solution) => { const Icon = solution.icon; return <Reveal key={solution.number}><article className="solution-row"><span className="solution-number">{solution.number}</span><Icon size={24} /><h3>{solution.title}</h3><p>{solution.text}</p><ArrowUpRight className="solution-arrow" size={20} /></article></Reveal>; })}</div><div className="integration-line"><span>SE CONECTA CON LO QUE YA USÁS</span><div><b>WhatsApp</b><b>Google Sheets</b><b>CRM</b><b>n8n</b><b>APIs</b><b>+ lo que haga falta</b></div></div></section>

    <section id="casos" className="section-padded cases-section"><div className="section-shell"><Reveal className="section-heading split-heading"><div><span className="section-kicker">03 / CASOS DE ÉXITO</span><h2>El trabajo habla<br /><span>por nosotros.</span></h2></div><p>Elegí un caso y recorré el tipo de problema que ayudamos a ordenar. Sin promesas abstractas: procesos más claros para equipos reales.</p></Reveal><div className="case-showcase"><div className="case-menu" role="tablist" aria-label="Casos de éxito">{cases.map((item, index) => <button key={item.name} className={activeCase === index ? 'is-active' : ''} onClick={() => setActiveCase(index)} role="tab" aria-selected={activeCase === index}><span>0{index + 1}</span><strong>{item.name}</strong><ArrowRight size={16} /></button>)}</div><div className="case-detail" role="tabpanel"><div className="case-detail-orb" /><div className="case-detail-top"><span className="case-label">{selectedCase.sector}</span><a href={selectedCase.url} target="_blank" rel="noreferrer">Ver sitio <ArrowUpRight size={15} /></a></div><CaseLogo item={selectedCase} large /><h3>{selectedCase.title}</h3><p>{selectedCase.text}</p><div className="case-details">{selectedCase.bullets.map(detail => <span key={detail}><Check size={14} />{detail}</span>)}</div><div className="case-detail-index">0{activeCase + 1}<span> / 0{cases.length}</span></div></div></div><div className="case-note"><Sparkles size={15} /> Los casos se presentan por el tipo de mejora trabajada. Las métricas se validan con cada equipo antes y después de implementar.</div></div></section>

    <section id="metodo" className="section-padded method-section"><div className="section-shell"><Reveal className="section-heading split-heading"><div><span className="section-kicker">04 / EL MÉTODO WIS</span><h2>Primero entendemos.<br /><span>Después automatizamos.</span></h2></div><p>La tecnología cambia rápido. El problema de tu negocio merece una solución pensada, medible y mantenible.</p></Reveal><div className="method-journey"><svg viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true"><path d="M0 110C150 15 230 157 375 78S594 32 710 103S890 149 1000 54" /><circle cx="0" cy="110" r="5" /><circle cx="375" cy="78" r="5" /><circle cx="710" cy="103" r="5" /><circle cx="1000" cy="54" r="5" /></svg>{[['01', 'Entendemos', 'Mapeamos tu operación y encontramos la fricción con mayor impacto.'], ['02', 'Diseñamos', 'Definimos reglas, integraciones y una primera versión que puedas probar.'], ['03', 'Construimos', 'Implementamos, medimos y mejoramos junto a tu equipo.']].map(([number, title, text]) => <div className="method-stop" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></div>)}</div><div className="quote-card"><div className="quote-mark">“</div><blockquote>No vendemos IA. Devolvemos tiempo, contexto y capacidad de decisión.</blockquote><span>— WIS / Work In Silence</span></div></div></section>

    <section className="section-shell section-padded fit-section"><Reveal className="section-heading"><span className="section-kicker">05 / PARA QUIÉN</span><h2>Si tu negocio crece,<br /><span>tu operación también tiene que hacerlo.</span></h2></Reveal><div className="fit-layout"><div className="fit-copy"><p>WIS es para equipos que quieren dejar de depender de héroes operativos, chats eternos y planillas que solo entiende una persona.</p><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-link">Contanos qué te está trabando <ArrowUpRight size={17} /></a></div><div className="fit-chips"><span>Retail</span><span>Salud</span><span>Inmobiliarias</span><span>Concesionarias</span><span>Servicios B2B</span><span>Educación</span><span>Estudios profesionales</span><span>Equipos comerciales</span></div></div></section>

    <section className="section-shell section-padded faq-section" id="faq"><Reveal className="section-heading split-heading"><div><span className="section-kicker">06 / PREGUNTAS FRECUENTES</span><h2>Antes de empezar,<br /><span>hablemos claro.</span></h2></div><p>Si la automatización no resuelve un problema real, es solo otra cosa que mantener.</p></Reveal><div className="faq-list">{faqs.map(([question, answer], index) => <Reveal key={question}><div className={`faq-item ${openFaq === index ? 'is-open' : ''}`}><button onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}><span>{question}</span><ChevronDown size={18} /></button>{openFaq === index && <p>{answer}</p>}</div></Reveal>)}</div></section>

    <section id="contacto" className="contact-section"><div className="section-shell contact-grid"><Reveal><span className="section-kicker">07 / HABLEMOS</span><h2>El próximo cuello de botella puede ser la próxima mejora.</h2><p>Contanos qué parte de tu operación te está sacando tiempo. Te respondemos con una mirada concreta, aunque todavía no estés listo para implementar.</p><div className="contact-direct"><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp directo <ArrowUpRight size={15} /></a><a href="mailto:ortu@wis-agency.com"><Mail size={17} /> ortu@wis-agency.com <ArrowUpRight size={15} /></a></div></Reveal><Reveal><form className="contact-form" onSubmit={submitContact}><div className="form-heading"><span>DIAGNÓSTICO INICIAL</span><b>Sin humo. Sin compromiso.</b></div><label>Nombre<input name="name" required placeholder="Tu nombre" /></label><label>Empresa<input name="company" placeholder="Nombre de tu empresa" /></label><label>Email<input name="email" required type="email" placeholder="tu@email.com" /></label><label>¿Qué te gustaría mejorar?<textarea name="message" required rows={4} placeholder="Ej: perdemos leads porque nadie hace el seguimiento..." /></label><button className="button button-primary" disabled={formStatus === 'sending'}>{formStatus === 'sending' ? 'Enviando...' : 'Enviar diagnóstico'} <Send size={16} /></button>{formStatus === 'success' && <p className="form-success">Recibimos tu mensaje. Te vamos a responder pronto.</p>}{formStatus === 'error' && <p className="form-error">No pudimos enviar el mensaje. Escribinos directo por WhatsApp.</p>}</form></Reveal></div></section>

    <section className="section-shell newsletter-section"><div><span className="section-kicker">WIS / SIGNAL</span><h3>Ideas prácticas para automatizar mejor.</h3><p>Una vez por mes: casos, aprendizajes y herramientas para hacer crecer tu operación.</p></div>{newsletterStatus === 'success' ? <div className="newsletter-success"><Check size={17} /> Listo. Te avisamos cuando salga el próximo.</div> : <form onSubmit={submitNewsletter}><input name="email" type="email" required placeholder="tu@email.com" aria-label="Tu email" /><button aria-label="Suscribirme"><ArrowRight size={18} /></button></form>}</section><footer className="footer section-shell"><div className="footer-brand"><BrandMark compact /><span>Work In Silence.</span></div><div className="footer-links"><a href="#soluciones">Lo que hacemos</a><a href="#casos">Casos</a><a href="#faq">FAQ</a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={14} /></a></div><div className="footer-copy">© 2026 WIS Agency<br />Automatización con IA · Argentina + LATAM</div></footer>
  </main>;
}
