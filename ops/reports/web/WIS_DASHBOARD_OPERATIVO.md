# WIS · Sistema comercial operativo

Fecha: 27 de septiembre de 2026

## Qué quedó armado

El proyecto ahora está centrado exclusivamente en prospección y outreach. Los únicos seis roles activos son:

1. `wis-orchestrator`: asigna lotes, dependencias y aprobaciones.
2. `prospect-research`: busca y valida prospectos.
3. `outreach-copy`: redacta email y WhatsApp.
4. `email-sender`: administra la cola y los resultados de email.
5. `whatsapp-sender`: procesa sólo contactos con opt-in.
6. `qa-ops`: controla datos, mensajes, permisos e idempotencia.

X, contenido, LinkedIn, web de marca y automatizaciones generales dejaron de ser parte del registro y la cola activa. Su código e historial siguen intactos para migrarlos a otro proyecto.

## Cómo se usa

El trabajo avanza en una cinta de lotes de 25:

- Research trabaja el lote N.
- Copy trabaja el lote N−1.
- Email procesa el lote N−2 aprobado.
- WhatsApp procesa contactos con opt-in del lote N−2 o anterior.
- QA controla cada transición sin hacer el trabajo del operador.

La planilla comercial conserva exactamente sus 12 columnas. Toda la operación de canal se registra por separado en `Outreach_Queue` y `Outreach_Events`.

## Controles que ya existen

- Aprobación humana por lote.
- Clave idempotente `prospect + campaña + canal + secuencia`.
- Email primero; WhatsApp nunca se dispara en simultáneo.
- WhatsApp bloqueado sin opt-in verificable.
- Fuera de 24 horas, WhatsApp exige plantilla aprobada.
- `OUTCOME_UNKNOWN` bloquea reintentos hasta reconciliación.
- Pausa ante autenticación, queja de spam o hard bounce superior al 2%.
- Límites: 25 emails/día y 10 WhatsApp/día, ambos cada 15 minutos.

## Estado real de las integraciones

La auditoría fue de sólo lectura.

- Gmail/Brevo: el alias `Ortu - WIS <ortu@wis-agency.com>` tuvo verificación histórica, pero todavía debe revalidarse la salud actual antes del canario.
- Email: no existe un sender WIS aislado versionado. No se reutilizarán flujos de BORA, MundoVera o QH.
- WhatsApp: los workflows WIS 01/02/03 están inactivos y sirven como base. WIS 03 necesita idempotencia y reconciliación.
- DUGAS y QH están separados y no fueron modificados.

## Qué podés hacer ahora

1. Continuar el research de distribuidoras en lotes de 25.
2. Validar cada lote con QA.
3. Aplicar los modelos A/B de `Prospectos potables - A B`.
4. Preparar una cola de canario sin enviar.
5. Cerrar los bloqueos técnicos de canales.
6. Aprobar 5 emails y hasta 2 WhatsApp con opt-in cuando el sistema esté listo.
7. Medir respuestas positivas, reuniones, propuestas, rebotes y bajas; no depender de aperturas.

## Qué falta antes de enviar

- Implementar el sender email WIS aislado.
- Revalidar alias, firma, reply-to, SPF, DKIM y DMARC.
- Aplicar idempotencia y reconciliación al sender de WhatsApp.
- Confirmar templates aprobados y ventana de 24 horas.
- Ejecutar el canario sólo después de aprobación humana registrada.

El dashboard muestra este estado sin inventar métricas: 0 mensajes nuevos en cola, 0 envíos nuevos y 4 bloqueos técnicos. No fue desplegado porque el despliegue también requiere aprobación.
