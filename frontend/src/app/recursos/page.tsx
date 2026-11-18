import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { resources, siteUrl } from '../site-content';
import '../recursos/resources-page.css';

export const metadata: Metadata = { title: 'Recursos sobre automatización e IA', description: 'Ideas prácticas de WIS para ordenar procesos, atención y seguimiento con sistemas inteligentes.', alternates: { canonical: `${siteUrl}/recursos` } };

export default function ResourcesPage() {
  return <main className="resources-page"><header><a href="/" className="resources-brand">WIS <small>Work in silence</small></a><a href="/#contacto">Hablemos <ArrowRight size={15} /></a></header><section className="resources-hero"><span>WIS / Recursos</span><h1>Ideas para que la operación deje de depender de la memoria.</h1><p>Notas breves para decidir qué ordenar, qué automatizar y qué conviene dejar en manos de tu equipo.</p></section><section className="resources-list">{resources.map((resource, index) => <article key={resource.slug}><small>0{index + 1}</small><div><h2>{resource.title}</h2><p>{resource.description}</p></div><ArrowRight size={18} /></article>)}</section></main>;
}
