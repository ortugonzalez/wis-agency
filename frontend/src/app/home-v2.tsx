'use client';

import { ArrowUpRight, Check, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { caseProfiles } from './site-content';
import './home-v2.css';
import './home-case.css';

const WHATSAPP_URL = 'https://wa.me/5491130035679';

const offers = [
  { number: '01', title: 'Presencia digital que comunica y convierte', text: 'Diseñamos la presencia digital que una empresa necesita para presentar su propuesta con claridad, generar confianza y recibir consultas.', examples: 'Landing · sitio institucional · portal comercial' },
  { number: '02', title: 'Sistemas a medida para operar mejor', text: 'Construimos plataformas internas, CRMs y herramientas propias cuando una planilla o un chat ya no ofrecen el orden necesario.', examples: 'CRM interno · tablero operativo · sistema de gestión' },
  { number: '03', title: 'Automatización de procesos existentes', text: 'Ordenamos procesos que ya funcionan y automatizamos las tareas repetitivas, cuidando la continuidad de la operación.', examples: 'Documentos · extractos · cobranzas · liquidación' },
  { number: '04', title: 'Asistentes para clientes y equipos', text: 'Creamos asistentes que responden, consultan información y derivan cada caso con el contexto necesario.', examples: 'Pedidos · WhatsApp · stock · consultas internas' },
] as const;

const process = [
  { number: '01', title: 'Auditoría operativa', text: 'Analizamos cómo funciona hoy la operación: entradas, decisiones, excepciones, responsables y resultados.' },
  { number: '02', title: 'Análisis de factibilidad', text: 'Definimos qué conviene automatizar, qué requiere una herramienta nueva y qué debe seguir bajo control del equipo.' },
  { number: '03', title: 'Diseño y prototipo', text: 'Acordamos el alcance, el recorrido y la solución. Cuando es necesario, validamos la idea con una prueba antes de construir.' },
  { number: '04', title: 'Implementación y evolución', text: 'Construimos, probamos con información real, capacitamos al equipo y acompañamos la mejora del sistema en producción.' },
] as const;

const homeCases = caseProfiles.map((item) => ({ ...item, title: item.label, detail: item.summary }));

function Brand() {
  return <span className="wis-home-brand"><Image src="/logo-transparent.png" alt="WIS" width={54} height={42} priority /><span>Work in silence</span></span>;
}

export default function HomeV2() {
  return <main className="wis-home">
    <div className="wis-home-progress" aria-hidden="true" />

    <nav className="wis-home-nav" aria-label="Navegación principal">
      <a href="#inicio" aria-label="WIS, volver al inicio"><Brand /></a>
      <div className="wis-home-nav-links"><a href="#soluciones">Qué hacemos</a><a href="#proceso">Cómo trabajamos</a><a href="#casos">Casos</a></div>
      <a className="wis-home-nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Contacto <ArrowUpRight size={15} /></a>
    </nav>

    <section id="inicio" className="wis-home-hero">
      <video className="wis-home-hero-video" autoPlay loop muted playsInline preload="metadata" poster="/og-image.png" aria-hidden="true"><source src="/wis-loop.mp4" type="video/mp4" /></video>
      <div className="wis-home-hero-overlay" />
      <div className="wis-home-container wis-home-hero-inner"><div className="wis-home-hero-copy"><span className="wis-home-eyebrow">WIS / Sistemas digitales para empresas</span><h1>Ordenamos lo que hoy depende demasiado de una persona.</h1><p>Analizamos la operación, definimos qué conviene resolver y construimos la solución: una landing, un sistema a medida, una automatización o un asistente.</p><div className="wis-home-actions"><a className="wis-home-button wis-home-button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Conversemos sobre tu situación <ArrowUpRight size={16} /></a><a className="wis-home-text-link" href="#proceso">Conocer nuestro proceso <ArrowUpRight size={15} /></a></div></div><div className="wis-home-hero-note"><span>Primera conversación</span><strong>30 minutos · sin compromiso</strong></div></div>
    </section>

    <section className="wis-home-proof" aria-label="Empresas y proyectos"><div className="wis-home-container wis-home-proof-inner"><span>Empresas y operaciones con las que trabajamos</span><div className="wis-home-proof-list">{homeCases.slice(0, 5).map((item) => <span key={item.name}>{item.name}</span>)}</div></div></section>

    <section id="soluciones" className="wis-home-section wis-home-solutions"><div className="wis-home-container"><div className="wis-home-section-intro"><span className="wis-home-eyebrow">01 / Qué hacemos</span><h2>Soluciones digitales para operaciones reales.</h2><p>No partimos de una herramienta. Entendemos el proceso y definimos la forma más simple de hacerlo funcionar mejor.</p></div><div className="wis-home-offers">{offers.map((offer) => <article className="wis-home-offer" key={offer.number}><span className="wis-home-offer-number">{offer.number}</span><div><h3>{offer.title}</h3><p>{offer.text}</p></div><small>{offer.examples}</small></article>)}</div></div></section>

    <section id="proceso" className="wis-home-section wis-home-process"><div className="wis-home-container"><div className="wis-home-section-intro wis-home-section-intro-wide"><span className="wis-home-eyebrow">02 / Cómo trabajamos</span><h2>Cada proyecto comienza con una evaluación.</h2><p>El primer resultado es entender el problema, definir qué solución tiene sentido y establecer cómo medir si funcionó.</p></div><div className="wis-home-process-list">{process.map((step) => <article className="wis-home-process-step" key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div><div className="wis-home-process-note"><Check size={16} /> Si una idea no es viable, lo indicamos antes de que inviertas en desarrollarla.</div></div></section>

    <section id="casos" className="wis-home-section wis-home-cases"><div className="wis-home-container"><div className="wis-home-section-intro"><span className="wis-home-eyebrow">03 / Casos WIS</span><h2>Casos que muestran cómo trabajamos.</h2><p>Cada proyecto parte de una operación distinta. En cada caso mostramos el punto de partida, la solución y la referencia pública disponible.</p></div><div className="wis-home-case-list">{homeCases.map((item, index) => <article className="wis-home-case" key={`${item.name}-${index}`}><div className="wis-home-case-heading"><span className="wis-home-case-index">0{index + 1}</span><div className="wis-home-case-identity">{item.logo ? <Image src={item.logo} alt={`Logo de ${item.name}`} width={150} height={48} /> : <strong>{item.name}</strong>}<div><h3>{item.name}</h3><span>{item.title}</span></div></div>{item.websiteUrl ? <a className="wis-home-case-reference" href={item.websiteUrl} target="_blank" rel="noreferrer">{item.websiteLabel} <ArrowUpRight size={15} /></a> : <span className="wis-home-case-reference is-muted">Proyecto WIS</span>}</div><div className="wis-home-case-compare"><div><span>Antes</span><p>{item.before}</p></div><div><span>Después</span><p>{item.after}</p></div></div><div className="wis-home-case-footer">{item.solutionSlug ? <a href={`/soluciones/${item.solutionSlug}`} aria-label={`Ver la solución de ${item.name}`}>Ver solución <ArrowUpRight size={15} /></a> : <span className="wis-home-case-pending">Información en preparación</span>}</div></article>)}</div><a className="wis-home-section-link" href="/casos">Ver portfolio completo <ArrowUpRight size={15} /></a></div></section>

    <section className="wis-home-final-cta"><div className="wis-home-container wis-home-final-inner"><div><span className="wis-home-eyebrow">04 / Próximo paso</span><h2>¿Existe un desafío distinto para tu empresa?</h2><p>Conversemos sobre la operación, el objetivo y la solución que puede hacer la diferencia.</p></div><a className="wis-home-button wis-home-button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Conversemos sobre tu situación</a></div></section>

    <footer className="wis-home-footer"><div className="wis-home-container wis-home-footer-inner"><Brand /><div><a href="mailto:ortu@wis-agency.com">ortu@wis-agency.com</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn</a></div><small>© 2026 WIS Agency · Argentina + LATAM</small></div></footer>
    <a className="wis-home-floating-wa" href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><MessageCircle size={20} /></a>
  </main>;
}
