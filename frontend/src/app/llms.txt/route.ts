import { NextResponse } from 'next/server';
import { caseProfiles, services, siteUrl, solutions } from '../site-content';

export function GET() {
  const body = `# WIS Agency

WIS diseña e implementa sistemas inteligentes para empresas de Argentina y LATAM. Conectamos inteligencia artificial, automatizaciones y las herramientas que los equipos ya usan para ordenar atención, seguimiento y operación.

## Sitio principal
- ${siteUrl}/ — Presentación de WIS y diagnóstico operativo.
- ${siteUrl}/soluciones — Catálogo de asistentes, automatizaciones, landing pages y sistemas a medida.
- ${siteUrl}/casos — Portfolio, clientes y contexto de trabajo publicado.
- ${siteUrl}/recursos — Recursos sobre automatización e IA aplicada.

## Servicios
${services.map((service) => `- ${siteUrl}/servicios/${service.slug} — ${service.title}`).join('\n')}

## Soluciones específicas
${solutions.map((solution) => `- ${siteUrl}/soluciones/${solution.slug} — ${solution.title}. Ejemplo: ${solution.exampleNote}`).join('\n')}

## Portfolio y ejemplos
${caseProfiles.map((client) => `- ${client.name} — ${client.summary}`).join('\n')}

## Contacto
- WhatsApp: https://wa.me/5491130035679
- Email: ortu@wis-agency.com
- Área: Argentina y LATAM

WIS no publica métricas, testimonios o capacidades que no hayan sido verificadas.
`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
