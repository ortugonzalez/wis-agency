import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { cases, siteUrl } from '../site-content';
import '../casos/cases-page.css';

export const metadata: Metadata = { title: 'Casos y clientes', description: 'Empresas que trabajan con WIS para ordenar su atención, seguimiento y operación.', alternates: { canonical: `${siteUrl}/casos` }, robots: { index: true, follow: true } };

export default function CasesPage() {
  return <main className="cases-page"><header><a href="/" className="cases-brand">WIS <small>Work in silence</small></a><a href="/#contacto">Hablemos <ArrowRight size={15} /></a></header><section className="cases-hero"><span>WIS / Clientes</span><h1>La operación cambia cuando el sistema deja de depender de la memoria.</h1><p>Trabajamos junto a equipos que necesitaban ordenar conversaciones, seguimientos y procesos. Cada historia se publica con hechos aprobados por el cliente.</p></section><section className="cases-list" aria-label="Clientes de WIS">{cases.map((client, index) => <article key={client}><small>0{index + 1}</small><h2>{client}</h2><span>Cliente WIS</span></article>)}</section><section className="cases-note"><span>Historias reales, no promesas.</span><p>Si querés conocer un caso parecido a tu operación, contanos qué proceso querés mejorar y te compartimos el contexto que podamos hacer público.</p><a href="/#contacto">Conversar con WIS <ArrowRight size={15} /></a></section></main>;
}
