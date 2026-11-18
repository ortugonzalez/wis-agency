import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { resources, siteUrl } from '../../site-content';
import '../article-page.css';

export function generateStaticParams() { return resources.map((resource) => ({ slug: resource.slug })); }

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const resource = resources.find((item) => item.slug === params.slug);
  if (!resource) return {};
  return { title: resource.title, description: resource.description, alternates: { canonical: `${siteUrl}/recursos/${resource.slug}` }, openGraph: { type: 'article', title: resource.title, description: resource.description, url: `${siteUrl}/recursos/${resource.slug}`, images: ['/og-image.png'] } };
}

export default function ResourcePage({ params }: { params: { slug: string } }) {
  const resource = resources.find((item) => item.slug === params.slug);
  if (!resource) notFound();
  const jsonLd = { '@context': 'https://schema.org', '@graph': [{ '@type': 'Article', headline: resource.title, description: resource.description, author: { '@type': 'Organization', name: 'WIS Agency', url: siteUrl }, publisher: { '@type': 'Organization', name: 'WIS Agency', url: siteUrl }, mainEntityOfPage: `${siteUrl}/recursos/${resource.slug}` }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: siteUrl }, { '@type': 'ListItem', position: 2, name: 'Recursos', item: `${siteUrl}/recursos` }, { '@type': 'ListItem', position: 3, name: resource.title, item: `${siteUrl}/recursos/${resource.slug}` }] }] };
  return <main className="article-page"><header><a href="/" className="article-brand">WIS <small>Work in silence</small></a><a href="/recursos">Recursos <ArrowRight size={15} /></a></header><nav className="article-breadcrumb" aria-label="Migas de pan"><a href="/">Inicio</a><span>/</span><a href="/recursos">Recursos</a><span>/</span><span>{resource.title}</span></nav><article><span className="article-kicker">WIS / Recursos</span><h1>{resource.title}</h1><p className="article-lead">{resource.description}</p><div className="article-body">{resource.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><footer><a href="/recursos">← Todos los recursos</a><a href="/#contacto">Hablar con WIS <ArrowRight size={15} /></a></footer></article><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /></main>;
}
