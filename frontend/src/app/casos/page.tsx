import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import { caseProfiles, siteUrl } from '../site-content';
import './cases-page.css';

export const metadata: Metadata = { title: 'Casos y clientes | WIS Agency', description: 'Casos de WIS: asistentes, automatizaciones, sistemas a medida y operaciones digitales para empresas.', alternates: { canonical: `${siteUrl}/casos` }, robots: { index: true, follow: true } };

export default function CasesPage() {
  return <main className="case-portfolio-page">
    <header className="case-portfolio-nav"><a href="/" className="case-portfolio-brand">WIS <small>Work in silence</small></a><a href="/#inicio">Conversemos <ArrowUpRight size={15} /></a></header>
    <section className="case-portfolio-hero"><span>WIS / Casos</span><h1>Casos que muestran cómo una operación puede trabajar mejor.</h1><p>Presentamos el punto de partida, la solución construida y las referencias públicas disponibles de cada proyecto.</p></section>
    <section className="case-portfolio-list" aria-label="Casos de WIS">
      {caseProfiles.map((item, index) => <article className="case-portfolio-card" key={`${item.name}-${index}`}>
        <div className="case-portfolio-card-head"><span className="case-portfolio-index">{String(index + 1).padStart(2, '0')}</span><div className="case-portfolio-identity"><div className="case-portfolio-brand">{item.logo ? <Image src={item.logo} alt={`Logo de ${item.name}`} width={170} height={54} /> : <strong>{item.name}</strong>}</div><span className="case-portfolio-role">{item.label}</span></div></div>
        <p className="case-portfolio-summary">{item.summary}</p>
        <div className="case-portfolio-comparisons"><div className="case-portfolio-comparison-head"><span>Antes</span><span>Después</span></div>{item.comparisons.map((comparison) => <div className="case-portfolio-comparison-row" key={`${item.name}-${comparison.label}`}><span className="case-portfolio-comparison-label">{comparison.label}</span><p>{comparison.before}</p><p>{comparison.after}</p></div>)}</div>
        <div className="case-portfolio-card-footer">{item.solutionSlug ? <a href={`/soluciones/${item.solutionSlug}`}>Ver solución <ArrowUpRight size={15} /></a> : <span>Información pública en preparación</span>}</div>
      </article>)}
    </section>
    <section className="case-portfolio-cta"><span>¿Existe una operación parecida?</span><h2>Conversemos sobre tu situación.</h2><p>Podemos revisar el proceso, evaluar alternativas y definir un próximo paso concreto.</p><a href="/#inicio">Conversemos con WIS <ArrowUpRight size={15} /></a></section>
  </main>;
}
