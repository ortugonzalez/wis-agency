import { NextResponse } from 'next/server';
import { services, cases, siteUrl } from '../site-content';

export function GET() {
  const body = `# WIS Agency\n\nWIS diseña e implementa sistemas inteligentes para empresas de Argentina y LATAM. Conectamos inteligencia artificial, automatizaciones y las herramientas que los equipos ya usan para ordenar atención, seguimiento y operación.\n\n## Sitio principal\n- ${siteUrl}/ — Presentación de WIS y diagnóstico operativo.\n- ${siteUrl}/casos — Clientes y contexto de trabajo publicado.\n- ${siteUrl}/recursos — Recursos sobre automatización e IA aplicada.\n\n## Servicios\n${services.map((service) => `- ${siteUrl}/servicios/${service.slug} — ${service.title}`).join('\n')}\n\n## Clientes publicados\n${cases.map((client) => `- ${client}`).join('\n')}\n\n## Contacto\n- WhatsApp: https://wa.me/5491130035679\n- Email: ortu@wis-agency.com\n- Área: Argentina y LATAM\n\nWIS no publica métricas, testimonios o capacidades que no hayan sido verificadas.\n`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
