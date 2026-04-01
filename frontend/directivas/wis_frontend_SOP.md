# WIS Frontend SOP

## Objetivo
Construir el frontend de `wis-agency.com` usando Next.js 14 y Tailwind CSS dentro del framework de directivas deterministas del usuario.

## Entradas
- **Identidad Visual**:
  - Fondo: #0A0A08
  - Acento: #F0B429
  - Texto: #F0EFE8
  - Superficies: #1E1E1A
  - Tipografías: Syne (700/800), DM Sans (400/500), JetBrains Mono
- **Secciones**:
  1. Nav: Logo (izq), links (der), CTA dorado (Hablemos).
  2. Hero: "Tu negocio en automático." (Syne 800 desde Google Fonts, tamaño elegante no gigante) / "Conectamos IA..." / CTA doble.
  3. Servicios: Grid 2x2. "Agentes de ventas...", "Automatización...", "Integraciones...", "Desarrollo...".
  4. Proceso: 3 pasos (1. Entendemos / 2. Diseñamos / 3. Construimos).
  5. Diferencial: 3 columnas (Nos metemos / Construimos / Work in Silence).
  6. Blog Preview: Grid 3. Mostrar 3 artículos ficticios de IA/automatización con imagen (unsplash/picsum) y bloque "Newsletter" (solo visual).
  7. Contacto: Form (POST http://localhost:4000/api/contact con modal/mensaje de éxito) y botones WhatsApp y Email para envío directo. Añadir bloque "Contactanos directamente" con email, instagram y WhatsApp en links separados.
  8. Footer: Copyright 2025. Sin redes genéricas (solo Instagram, WhatsApp y Email).

## Reglas de Diseño
- Dark mode permanente.
- Animaciones sutiles fade in en scroll.
- Mobile responsive.
- Solo tipografía e íconos SVG simples (sin imágenes por el momento).

## Ejecución Lógica
El script en `scripts/wis_frontend_builder.py` se encarga de:
1. Instalar dependencias base de Next.js mediante NPX para el directorio `wis-frontend`.
2. Escribir las fuentes base en `app/layout.tsx`.
3. Intervenir `tailwind.config.ts` para integrar colores custom y las fuentes de Google.
4. Redactar el código en `app/page.tsx` con toda la UI descrita.

## Trampas Conocidas / Restricciones
- Al invocar comandos `npx`, estos requieren aprobación y pueden quedar congelados si requieren un input interactivo no forzado con `-y` en Python `subprocess`.
- Asegurar que `tailwind.config.ts` expone las propiedades sobreescribiendo o extendiendo el esquema en `theme.extend`.
- Evitar librerías pesadas extras sin necesidad; solo React Icons (`lucide-react`) o SVGs quemados.
- **RESTRICTION**: En Next.js 14, usar algunos íconos de `lucide-react` (ej. Instagram) puede generar error de "barrel optimization" al buildear. En caso de fallar, usar inline SVG en su lugar.
