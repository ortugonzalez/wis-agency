'use client';

import { ArrowUpRight, Check, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { caseProfiles } from './site-content';
import './home-v2.css';

const WHATSAPP_URL = 'https://wa.me/5491130035679';

const offers = [
  { number: '01', title: 'Landing pages que explican y convierten', text: 'Diseñamos la presencia digital que tu negocio necesita para presentar una propuesta clara, generar confianza y recibir consultas.', examples: 'Landing · sitio institucional · portal comercial' },
  { number: '02', title: 'Sistemas a medida para trabajar mejor', text: 'Construimos plataformas internas, CRMs y herramientas propias cuando una planilla o un chat ya no alcanzan.', examples: 'CRM interno · tablero operativo · sistema de gestión' },
  { number: '03', title: 'Automatización de procesos existentes', text: 'Ordenamos lo que ya sucede y automatizamos las tareas repetitivas, sin obligar al equipo a cambiar todo de golpe.', examples: 'Documentos · extractos · cobranzas · liquidación' },
  { number: '04', title: 'Asistentes para clientes y equipos', text: 'Creamos asistentes que responden, consultan información y derivan cada caso con el contexto necesario.', examples: 'Pedidos · WhatsApp · stock · consultas internas' },
] as const;

const process = [
  { number: '01', title: 'Auditoría operativa', text: 'Conversamos con las personas que hacen el trabajo y recorremos el proceso real: entradas, decisiones, excepciones y salidas.' },
  { number: '02', title: 'Análisis de factibilidad', text: 'Separamos lo que conviene automatizar, lo que necesita una herramienta nueva y lo que es mejor dejar en manos del equipo.' },
  { number: '03', title: 'Diseño y prototipo', text: 'Definimos el alcance, el recorrido y la arquitectura. Cuando ayuda, armamos una prueba para validar la idea antes de construir.' },
  { number: '04', title: 'Implementación y evolución', text: 'Construimos, probamos con datos reales, capacitamos al equipo y acompañamos la mejora del sistema en producción.' },
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
      <a className="wis-home-nav-cta" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Hablemos <ArrowUpRight size={15} /></a>
    </nav>

    <section id="inicio" className="wis-home-hero">
      <video className="wis-home-hero-video" autoPlay loop muted playsInline preload="metadata" poster="/og-image.png" aria-hidden="true"><source src="/wis-loop.mp4" type="video/mp4" /></video>
      <div className="wis-home-hero-overlay" />
      <div className="wis-home-container wis-home-hero-inner"><div className="wis-home-hero-copy"><span className="wis-home-eyebrow">WIS / Sistemas digitales para empresas</span><h1>Ordenamos lo que hoy depende demasiado de una persona.</h1><p>Auditamos tu operación, evaluamos qué conviene hacer y construimos la solución: una landing, un sistema a medida, una automatización o un asistente.</p><div className="wis-home-actions"><a className="wis-home-button wis-home-button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer">Contarnos el problema <ArrowUpRight size={16} /></a><a className="wis-home-text-link" href="#proceso">Ver cómo empezamos <ArrowUpRight size={15} /></a></div></div><div className="wis-home-hero-note"><span>Primera conversación</span><strong>30 minutos · sin compromiso</strong></div></div>
    </section>

    <section className="wis-home-proof" aria-label="Empresas y proyectos"><div className="wis-home-container wis-home-proof-inner"><span>Proyectos y operaciones que ya trabajamos</span><div className="wis-home-proof-list">{homeCases.slice(0, 5).map((item) => <span key={item.name}>{item.name}</span>)}</div></div></section>

    <section id="soluciones" className="wis-home-section wis-home-solutions"><div className="wis-home-container"><div className="wis-home-section-intro"><span className="wis-home-eyebrow">01 / Qué hacemos</span><h2>Una solución clara para el problema que tenés.</h2><p>No vendemos una herramienta aislada. Entendemos el proceso y elegimos la forma más simple de hacerlo funcionar mejor.</p></div><div className="wis-home-offers">{offers.map((offer) => <article className="wis-home-offer" key={offer.number}><span className="wis-home-offer-number">{offer.number}</span><div><h3>{offer.title}</h3><p>{offer.text}</p></div><small>{offer.examples}</small></article>)}</div></div></section>

    <section id="proceso" className="wis-home-section wis-home-process"><div className="wis-home-container"><div className="wis-home-section-intro wis-home-section-intro-wide"><span className="wis-home-eyebrow">02 / Cómo trabajamos</span><h2>Antes de construir, entendemos si vale la pena construir.</h2><p>El primer resultado no es código: es saber qué problema existe, qué solución tiene sentido y cómo medir si funcionó.</p></div><div className="wis-home-process-list">{process.map((step) => <article className="wis-home-process-step" key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div><div className="wis-home-process-note"><Check size={16} /> Si el proyecto no es viable, te lo decimos antes de que inviertas en desarrollarlo.</div></div></section>

    <section id="casos" className="wis-home-section wis-home-cases"><div className="wis-home-container"><div className="wis-home-section-intro"><span className="wis-home-eyebrow">03 / Casos WIS</span><h2>Lo que hacemos se entiende mejor con nombres concretos.</h2><p>Cada proyecto parte de una operación distinta. Estos son los problemas y soluciones que podemos mostrar hoy.</p></div><div className="wis-home-case-list">{homeCases.map((item, index) => <article className="wis-home-case" key={`${item.name}-${index}`}><span className="wis-home-case-index">0{index + 1}</span><div className="wis-home-case-main"><h3>{item.name}</h3><span>{item.title}</span></div><p>{item.detail}</p>{item.solutionSlug ? <a href={`/soluciones/${item.solutionSlug}`} aria-label={`Ver la solución de ${item.name}`}>Ver solución <ArrowUpRight size={15} /></a> : <span className="wis-home-case-pending">Información en preparación</span>}</article>)}</div><a className="wis-home-section-link" href="/casos">Ver portfolio completo <ArrowUpRight size={15} /></a></div></section>

    <section className="wis-home-final-cta"><div className="wis-home-container wis-home-final-inner"><div><span className="wis-home-eyebrow">04 / Próximo paso</span><h2>¿Tenés otra cosa diferente a esto?</h2><p>Escribinos. Si el proceso existe, lo podemos entender y armar con vos.</p></div><a className="wis-home-button wis-home-button-primary" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Hablar con WIS</a></div></section>

    <footer className="wis-home-footer"><div className="wis-home-container wis-home-footer-inner"><Brand /><div><a href="mailto:ortu@wis-agency.com">ortu@wis-agency.com</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a><a href="https://www.linkedin.com/company/wis-agency/" target="_blank" rel="noreferrer">LinkedIn</a></div><small>© 2026 WIS Agency · Argentina + LATAM</small></div></footer>
    <a className="wis-home-floating-wa" href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><MessageCircle size={20} /></a>
  </main>;
}
