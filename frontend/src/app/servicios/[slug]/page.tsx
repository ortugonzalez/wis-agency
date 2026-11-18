import type { Metadata } from 'next';
import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { services, siteUrl } from '../../site-content';
import '../service-page.css';

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const service = services.find((item) => item.slug === params.slug);
  if (!service) return {};
  return {
    title: `${service.keyword} | WIS Agency`,
    description: service.description,
    alternates: { canonical: `${siteUrl}/servicios/${service.slug}` },
    openGraph: { title: `${service.keyword} | WIS Agency`, description: service.description, url: `${siteUrl}/servicios/${service.slug}`, images: ['/og-image.png'] },
  };
}

export default function ServicePage({ params }: { params: { slug: string } }) {
  const service = services.find((item) => item.slug === params.slug);
  if (!service) notFound();

  const jsonLd = { '@context': 'https://schema.org', '@type': 'Service', name: service.title, description: service.description, provider: { '@type': 'Organization', name: 'WIS Agency', url: siteUrl }, areaServed: ['Argentina', 'LATAM'] };

  return <main className="service-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <header className="service-page-nav"><a href="/" className="service-page-brand"><span>WIS</span><small>Work in silence</small></a><a href="/#contacto">Hablemos <ArrowRight size={15} /></a></header>
    <section className="service-page-hero"><div><span className="service-page-kicker">WIS / {service.number} · {service.name}</span><h1>{service.title}</h1><p>{service.description}</p><a className="service-page-cta" href="https://wa.me/5491130035679" target="_blank" rel="noreferrer">Agendar diagnóstico <MessageCircle size={16} /></a></div><aside><span>Lo que ordenamos</span><ul>{service.bullets.map((bullet) => <li key={bullet}><Check size={16} />{bullet}</li>)}</ul></aside></section>
    <section className="service-page-body"><div><span className="service-page-kicker">El punto de partida</span><h2>La tecnología no reemplaza el criterio.<br /><em>Lo vuelve operativo.</em></h2></div><div><p>Antes de construir, miramos cómo entra la información, quién decide, qué se repite y dónde se corta el recorrido. La solución se diseña alrededor de tu forma de trabajar, no alrededor de una herramienta.</p><p>El resultado es un sistema que el equipo puede entender, usar y mejorar.</p></div></section>
    <section className="service-page-process"><div><span className="service-page-kicker">Cómo lo hacemos</span><h2>De la primera conversación a producción.</h2></div><ol><li><b>01</b><div><h3>Entender</h3><p>Mapeamos el proceso real, sus excepciones y el costo de seguir haciéndolo a mano.</p></div></li><li><b>02</b><div><h3>Diseñar</h3><p>Elegimos la solución más simple que pueda resolver el problema con tus herramientas actuales.</p></div></li><li><b>03</b><div><h3>Implementar</h3><p>Construimos, probamos con datos reales y acompañamos la puesta en marcha.</p></div></li><li><b>04</b><div><h3>Estabilizar</h3><p>Documentamos, medimos y dejamos claro cómo sostener y mejorar el sistema.</p></div></li></ol></section>
    <footer className="service-page-footer"><span>WIS / Sistemas inteligentes para empresas</span><a href="/">Volver a WIS <ArrowRight size={15} /></a></footer>
  </main>;
}
