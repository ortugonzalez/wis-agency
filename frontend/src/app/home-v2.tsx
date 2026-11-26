'use client';

import { useState } from 'react';

import { ArrowUpRight, Check, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { caseProfiles } from './site-content';
import './home-v2.css';
import './home-case.css';

const WHATSAPP_URL = 'https://wa.me/5491130035679';

const offers: ReadonlyArray<{ number: string; title: string; text: string; examples: string; caseNames: readonly string[] }> = [
  { number: '01', title: 'Presencia digital', text: 'Landing pages y sitios que explican mejor el negocio, presentan la propuesta y reciben consultas.', examples: 'Landing · sitio institucional · portal comercial', caseNames: ['Movimientos Indumec'] },
  { number: '02', title: 'Sistemas de gestión', text: 'Plataformas internas, CRMs y herramientas propias para ordenar clientes, tareas y decisiones.', examples: 'CRM interno · recompra · tablero operativo · sistema de gestión', caseNames: ['Administración Pacífico', 'Hotel Bristol', 'Movimientos Indumec'] },
  { number: '03', title: 'Automatización operativa', text: 'Procesos existentes que pueden funcionar con menos carga manual y mejor seguimiento.', examples: 'Documentos · extractos · cobranzas · liquidación', caseNames: ['IMEPHO', 'Administración Bruno', 'Doña Francisca', 'Metzeler Joyas'] },
  { number: '04', title: 'Asistentes para clientes y equipos', text: 'Asistentes que toman pedidos, responden consultas y derivan cada caso con el contexto necesario.', examples: 'Pedidos · WhatsApp · stock · consultas internas', caseNames: ['DUGAS', 'QUALITYHARD'] },
] as const;

const process = [
  { number: '01', title: 'Auditoría operativa', text: 'Analizamos cómo funciona hoy la operación: entradas, decisiones, excepciones, responsables y resultados.' },
  { number: '02', title: 'Análisis de factibilidad', text: 'Definimos qué conviene automatizar, qué requiere una herramienta nueva y qué debe seguir bajo control del equipo.' },
  { number: '03', title: 'Diseño y prototipo', text: 'Acordamos el alcance, el recorrido y la solución. Cuando es necesario, validamos la idea con una prueba antes de construir.' },
  { number: '04', title: 'Implementación y evolución', text: 'Construimos, probamos con información real, capacitamos al equipo y acompañamos la mejora del sistema en producción.' },
] as const;

const homeCases = caseProfiles.map((item) => ({ ...item, title: item.label, detail: item.summary }));
const featuredCases = homeCases;

function caseId(name: string) {
  return `caso-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function Brand() {
  return <span className="wis-home-brand"><span className="wis-home-brand-wordmark">WIS</span><span className="wis-home-brand-copy">Work in silence</span></span>;
}

export default function HomeV2() {
  const [activeOfferNumber, setActiveOfferNumber] = useState(offers[0].number);
  const activeOffer = offers.find((offer) => offer.number === activeOfferNumber) ?? offers[0];
  const relatedCases = featuredCases.filter((item) => activeOffer.caseNames.includes(item.name));
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
      <div className="wis-home-container wis-home-hero-inner"><div className="wis-home-hero-copy"><span className="wis-home-eyebrow">Sistemas digitales para empresas</span><h1>Ordenamos lo que hoy depende demasiado de una persona.</h1><p>Analizamos cómo trabaja hoy tu empresa y construimos la solución que necesita: una landing, un sistema a medida, una automatización o un asistente.</p><div className="wis-home-actions"><a className="wis-home-button wis-home-button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Conversemos sobre tu situación <ArrowUpRight size={16} /></a><a className="wis-home-text-link" href="#proceso">Conocer nuestro proceso <ArrowUpRight size={15} /></a></div></div><div className="wis-home-hero-note"><span>Primera conversación</span><strong>30 minutos · sin compromiso</strong></div></div>
    </section>

    <section id="soluciones" className="wis-home-section wis-home-solutions"><div className="wis-home-container"><div className="wis-home-section-intro"><span className="wis-home-eyebrow">01 / Qué hacemos</span><h2>Soluciones digitales para operaciones reales.</h2><p>Elegí una solución para ver qué proyectos la respaldan.</p></div><div className="wis-home-offers"><div className="wis-home-offer-list" role="tablist" aria-label="Soluciones de WIS">{offers.map((offer) => <button className={`wis-home-offer${activeOfferNumber === offer.number ? ' is-active' : ''}`} key={offer.number} type="button" role="tab" aria-selected={activeOfferNumber === offer.number} onClick={() => setActiveOfferNumber(offer.number)}><span className="wis-home-offer-number">{offer.number}</span><span className="wis-home-offer-title">{offer.title}</span><ArrowUpRight size={17} /></button>)}</div><div className="wis-home-offer-detail" role="tabpanel"><span className="wis-home-offer-detail-label">{activeOffer.number} / Solución</span><h3>{activeOffer.title}</h3><p>{activeOffer.text}</p><small>{activeOffer.examples}</small><div className="wis-home-offer-examples"><span>Casos relacionados</span><div>{relatedCases.map((item) => <a key={item.name} href={`#${caseId(item.name)}`}>{item.name} <ArrowUpRight size={14} /></a>)}</div></div></div></div></div></section>

    <section id="proceso" className="wis-home-section wis-home-process"><div className="wis-home-container"><div className="wis-home-section-intro wis-home-section-intro-wide"><span className="wis-home-eyebrow">02 / Cómo trabajamos</span><h2>Cada proyecto comienza con una evaluación.</h2><p>El primer resultado es entender el problema, definir qué solución tiene sentido y establecer cómo medir si funcionó.</p></div><div className="wis-home-process-list">{process.map((step) => <article className="wis-home-process-step" key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div><div className="wis-home-process-note"><Check size={16} /> Si una idea no es viable, lo indicamos antes de que inviertas en desarrollarla.</div></div></section>

    <section id="casos" className="wis-home-section wis-home-cases"><div className="wis-home-container"><div className="wis-home-section-intro"><span className="wis-home-eyebrow">03 / Casos WIS</span><h2>Proyectos que muestran cómo trabajamos.</h2><p>El punto de partida, lo que construimos y cómo cambia la operación después.</p></div><div className="wis-home-case-list">{featuredCases.map((item, index) => <article id={caseId(item.name)} className="wis-home-case" key={`${item.name}-${index}`}><div className="wis-home-case-heading"><span className="wis-home-case-index">{String(index + 1).padStart(2, '0')}</span><div className="wis-home-case-identity"><div className="wis-home-case-brand">{item.logo ? <Image src={item.logo} alt={`Logo de ${item.name}`} width={170} height={54} /> : <strong>{item.name}</strong>}</div><span className="wis-home-case-role">{item.title}</span></div></div><div className="wis-home-case-comparisons"><div className="wis-home-case-comparison-head"><span>Antes</span><span>Después</span></div>{item.comparisons.map((comparison) => <div className="wis-home-case-comparison-row" key={`${item.name}-${comparison.label}`}><span className="wis-home-case-comparison-label">{comparison.label}</span><p>{comparison.before}</p><p>{comparison.after}</p></div>)}</div><div className="wis-home-case-footer">{item.solutionSlug ? <a href={`/soluciones/${item.solutionSlug}`} aria-label={`Ver la solución de ${item.name}`}>Ver solución <ArrowUpRight size={15} /></a> : <span className="wis-home-case-pending">Información en preparación</span>}</div></article>)}</div><a className="wis-home-section-link" href="/casos">Ver todos los casos <ArrowUpRight size={15} /></a></div></section>

    <section className="wis-home-final-cta"><div className="wis-home-container wis-home-final-inner"><div><span className="wis-home-eyebrow">04 / Próximo paso</span><h2>¿Existe un desafío distinto para tu empresa?</h2><p>Conversemos sobre la operación, el objetivo y la solución que puede hacer la diferencia.</p></div><a className="wis-home-button wis-home-button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Conversemos sobre tu situación</a></div></section>

    <footer className="wis-home-footer"><div className="wis-home-container wis-home-footer-inner"><Brand /><div><a href="mailto:ortu@wis-agency.com">ortu@wis-agency.com</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a><a href="https://www.linkedin.com/in/octavio-ortu-gonzalez-pereyra-011819200/" target="_blank" rel="noreferrer">LinkedIn</a></div><small>© 2026 WIS Agency · Argentina + LATAM</small></div></footer>
    <a className="wis-home-floating-wa" href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><MessageCircle size={20} /></a>
  </main>;
}
