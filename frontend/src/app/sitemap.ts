import type { MetadataRoute } from "next";
import { solutions } from './site-content';

export default function sitemap(): MetadataRoute.Sitemap {
  const published = [
    '',
    '/soluciones',
    '/casos',
    '/recursos',
    '/servicios/agentes-ia-para-atencion',
    '/servicios/automatizacion-comercial',
    '/servicios/automatizacion-de-procesos',
    '/servicios/integracion-de-sistemas',
    '/recursos/que-proceso-automatizar-primero',
    '/recursos/automatizacion-de-whatsapp-para-empresas',
    '/recursos/conectar-whatsapp-crm-google-sheets',
    '/recursos/agentes-de-ia-cuando-sirven',
    ...solutions.map((solution) => `/soluciones/${solution.slug}`),
  ];
  return [
    ...published.map((path, index) => ({ url: `https://wis-agency.com${path}`, lastModified: '2026-11-25', changeFrequency: index === 0 ? 'weekly' as const : 'monthly' as const, priority: index === 0 ? .9 : .7 })),
  ];
}
