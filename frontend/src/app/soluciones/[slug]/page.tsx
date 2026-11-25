import type { Metadata } from 'next';
import { ArrowRight, Check, MessageCircle, Play } from 'lucide-react';
import { notFound } from 'next/navigation';
import { solutions, siteUrl } from '../../site-content';
import '../solutions-page.css';

export function generateStaticParams() { return solutions.map((solution) => ({ slug: solution.slug })); }

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const solution = solutions.find((item) => item.slug === params.slug);
  if (!solution) return {};
  return { title: `${solution.title} | WIS Agency`, description: solution.short, alternates: { canonical: `${siteUrl}/soluciones/${solution.slug}` }, openGraph: { title: `${solution.title} | WIS Agency`, description: solution.short, url: `${siteUrl}/soluciones/${solution.slug}`, images: ['/og-image.png'] } };
}

export default function SolutionPage({ params }: { params: { slug: string } }) {
  const solution = solutions.find((item) => item.slug === params.slug);
  if (!solution) notFound();

  const jsonLd = { '@context': 'https://schema.org', '@graph': [{ '@type': 'Service', name: solution.title, description: solution.detail, provider: { '@type': 'Organization', name: 'WIS Agency', url: siteUrl }, areaServed: ['Argentina', 'LATAM'] }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl }, { '@type': 'ListItem', position: 2, name: 'Soluciones', item: `${siteUrl}/soluciones` }, { '@type': 'ListItem', position: 3, name: solution.title, item: `${siteUrl}/soluciones/${solution.slug}` }] }] };

  return <main className="solution-detail-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <header className="solutions-page-nav"><a href="/" className="solutions-brand">WIS <small>Work in silence</small></a><a href="/#contacto">Hablemos <ArrowRight size={15} /></a></header>
    <nav className="solutions-breadcrumb" aria-label="Migas de pan"><a href="/">Inicio</a><span>/</span><a href="/soluciones">Soluciones</a><span>/</span><span>{solution.title}</span></nav>
    <section className="solution-detail-hero"><div><span>{solution.number} / {solution.category}</span><h1>{solution.title}</h1><p>{solution.detail}</p><a className="solution-detail-cta" href="/#contacto">Hablar de este proyecto <MessageCircle size={16} /></a></div><aside><small>Qué puede incluir</small><ul>{solution.tags.map((tag) => <li key={tag}><Check size={15} />{tag}</li>)}</ul></aside></section>
    <section className="solution-detail-proof"><div><span>Ejemplo WIS</span><h2>{solution.exampleNote}</h2></div><div><p>El ejemplo funciona como referencia del tipo de solución. Los resultados, alcances y demos públicas se agregan únicamente cuando están aprobados y disponibles.</p>{solution.demoUrl ? <a href={solution.demoUrl} target="_blank" rel="noreferrer">Ver demo <Play size={14} /></a> : <span className="solution-pending">Demo pública: link pendiente</span>}</div></section>
    <section className="solution-detail-process"><span>Cómo se construye</span><ol><li><b>01</b><div><h3>Entender el recorrido</h3><p>Miramos qué información entra, quién decide, qué se repite y dónde se corta el proceso.</p></div></li><li><b>02</b><div><h3>Diseñar la primera versión</h3><p>Definimos reglas, excepciones, integraciones y un alcance que se pueda probar rápido.</p></div></li><li><b>03</b><div><h3>Implementar y estabilizar</h3><p>Construimos con datos reales, documentamos y dejamos un sistema que el equipo pueda sostener.</p></div></li></ol></section>
    <footer className="solutions-footer"><span>WIS / Sistemas inteligentes para empresas</span><a href="/soluciones">Ver todas las soluciones <ArrowRight size={15} /></a></footer>
  </main>;
}
