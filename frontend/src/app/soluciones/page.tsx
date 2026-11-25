import type { Metadata } from 'next';
import { ArrowRight, ArrowUpRight, MessageCircle } from 'lucide-react';
import { solutionCategories, solutions, siteUrl } from '../site-content';
import './solutions-page.css';

export const metadata: Metadata = {
  title: 'Soluciones para empresas | WIS Agency',
  description: 'Asistentes, automatizaciones, landing pages, CRMs internos y sistemas a medida para ordenar operaciones reales.',
  alternates: { canonical: `${siteUrl}/soluciones` },
  openGraph: { title: 'Soluciones para empresas | WIS Agency', description: 'Asistentes, automatizaciones y sistemas a medida para empresas.', url: `${siteUrl}/soluciones`, images: ['/og-image.png'] },
};

export default function SolutionsPage() {
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Soluciones WIS', url: `${siteUrl}/soluciones`, description: metadata.description },
    { '@type': 'ItemList', itemListElement: solutions.map((solution, index) => ({ '@type': 'ListItem', position: index + 1, name: solution.title, url: `${siteUrl}/soluciones/${solution.slug}` })) },
  ] };

  return <main className="solutions-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <header className="solutions-page-nav"><a href="/" className="solutions-brand">WIS <small>Work in silence</small></a><a href="/#contacto">Hablemos <ArrowRight size={15} /></a></header>
    <nav className="solutions-breadcrumb" aria-label="Migas de pan"><a href="/">Inicio</a><span>/</span><span>Soluciones</span></nav>
    <section className="solutions-hero"><span>WIS / Soluciones</span><h1>Lo que tu negocio necesita construir para trabajar mejor.</h1><p>Una landing, un asistente, una automatización o un sistema completo. Empezamos por el problema y armamos la solución que el equipo puede usar.</p></section>
    <section className="solutions-index" aria-label="Catálogo de soluciones">
      <div className="solutions-index-head"><span>Catálogo de soluciones</span><small>{solutions.length} formas de empezar · una misma lógica de trabajo</small></div>
      {solutionCategories.slice(1).map((category) => <div className="solutions-group" key={category}><div className="solutions-group-label">{category}</div><div className="solutions-group-list">{solutions.filter((solution) => solution.category === category).map((solution) => <a href={`/soluciones/${solution.slug}`} key={solution.slug}><span>{solution.number}</span><div><h2>{solution.title}</h2><p>{solution.short}</p><small>{solution.exampleNote}</small></div><ArrowUpRight size={19} /></a>)}</div></div>)}
    </section>
    <section className="solutions-cta"><div><span>¿No encontrás exactamente lo que necesitás?</span><h2>Si el proceso existe,<br /><em>lo podemos entender.</em></h2></div><a href="/#contacto">Contarnos el problema <MessageCircle size={16} /></a></section>
    <footer className="solutions-footer"><span>WIS / Sistemas inteligentes para empresas</span><a href="/">Volver a WIS <ArrowRight size={15} /></a></footer>
  </main>;
}
