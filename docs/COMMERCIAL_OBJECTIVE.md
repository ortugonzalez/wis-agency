# Objetivo comercial operativo WIS

## Prioridad inmediata

Preparar lotes de 20–30 prospectos completos y empezar por email. WhatsApp queda como segundo canal y sólo puede utilizarse cuando exista consentimiento verificable. Ningún prospecto recibe ambos canales en simultáneo.

Cada email se prueba también mediante un mensaje semilla separado a un buzón propio. Nunca se usa CC ni BCC para las pruebas de entrega.

## Registro comercial

`PROSPECTOS` conserva exactamente 12 columnas visibles: rubro, empresa, ubicación, WhatsApp, web, email, rating, reseñas analizadas, problemas, análisis del negocio, mensaje WhatsApp y mensaje email.

No se completa una fila con datos supuestos. La información operativa, la evidencia y los eventos viven fuera de la hoja comercial.

## Reseñas y propuesta

Para cada negocio:

1. Abrir la ficha exacta en Google Maps.
2. Entrar a Reseñas u Opiniones.
3. Filtrar por Google y ordenar por valoración más baja.
4. Leer únicamente reseñas individuales de 1–3★.
5. Guardar URL, fecha, cantidades y evidencia durable.
6. Resumir patrones sin nombres de usuarios ni acusaciones textuales.
7. Proponer sólo una solución que WIS pueda construir y demostrar.

Si no existe una oportunidad específica suficientemente sustentada, ofrecer un abanico honesto de tres pilares:

- Atención y ventas: chatbot de WhatsApp, derivación, calificación y seguimiento comercial.
- Administración: preparación y validación de novedades de sueldos, remitos, facturas y documentos.
- Operaciones y control: incidencias, mantenimiento, responsables, alertas y tableros.

La automatización administrativa no sustituye controles contables, laborales o legales que no estén integrados.

## Gates de salida

- Email individual, primero, con QA independiente y aprobación exacta por lote: máximo 25 por día, intervalo mínimo de 15 minutos y ventana 09:30–17:30 `America/Buenos_Aires`. Los seguimientos de días 3 y 7 requieren aprobación.
- Prueba semilla separada al buzón propio antes del canario externo.
- WhatsApp sólo con opt-in verificable y aprobación independiente: máximo 10 por día, intervalo mínimo de 15 minutos y un único seguimiento aprobado. Fuera de la ventana de 24 horas desde el último mensaje entrante, sólo se usa una plantilla aprobada.
- Publicar un número en Maps o en una web no constituye consentimiento.
- Email y WhatsApp nunca se ejecutan simultáneamente para el mismo prospecto.
- Un timeout se registra como `OUTCOME_UNKNOWN` y no se reintenta hasta reconciliarlo.
- No tocar DUGAS ni QH.

## Modelo mínimo de equipo

Sólo cuatro roles activos: `wis-orchestrator`, `prospect-intelligence`, `outreach-ops` y `qa-ops`. Los roles históricos quedan como documentación, no como agentes activos.
