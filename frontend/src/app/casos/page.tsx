import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { caseProfiles, siteUrl } from '../site-content';
import '../casos/cases-page.css';

export const metadata: Metadata = { title: 'Casos y clientes', description: 'Empresas que trabajan con WIS para ordenar su atención, seguimiento y operación.', alternates: { canonical: `${siteUrl}/casos` }, robots: { index: true, follow: true } };

export default function CasesPage() {
  return <main className="cases-page"><header><a href="/" className="cases-brand">WIS <small>Work in silence</small></a><a href="/#contacto">Hablemos <ArrowRight size={15} /></a></header><section className="cases-hero"><span>WIS / Portfolio</span><h1>Soluciones reales para operaciones que necesitaban orden.</h1><p>Reunimos los proyectos, ejemplos y líneas de trabajo de WIS. Cada historia se publica con el alcance y los resultados que podemos hacer públicos.</p></section><section className="cases-list" aria-label="Portfolio de WIS">{caseProfiles.map((item, index) => <article key={`${item.name}-${index}`}><small>0{index + 1}</small><div className="case-profile-title">{item.logo && <Image src={item.logo} alt={`Logo de ${item.name}`} width={110} height={52} />}<h2>{item.name}</h2><span>{item.label}</span></div><div className="case-profile-copy"><p>{item.summary}</p>{item.solutionSlug ? <a href={`/soluciones/${item.solutionSlug}`}>Ver solución <ArrowRight size={14} /></a> : <small>Información pública en preparación</small>}</div></article>)}</section><section className="cases-note"><span>¿Tenés una operación parecida?</span><p>Contanos qué proceso querés mejorar. Podemos mostrarte el contexto de un caso relacionado o pensar una solución nueva con vos.</p><a href="/#contacto">Conversar con WIS <ArrowRight size={15} /></a></section></main>;
}
