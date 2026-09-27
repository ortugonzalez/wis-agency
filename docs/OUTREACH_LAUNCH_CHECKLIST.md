# WIS · Checklist de puesta en marcha comercial

Fecha de corte: 27 de septiembre de 2026  
Estado general: **fundación operativa lista; canales reales bloqueados**

Este documento define qué falta para pasar del dry-run a una operación real de prospección. El orden importa: no se debe ejecutar un canario hasta cerrar los puntos críticos de canal y registrar una aprobación humana.

## 1. Bloqueos críticos antes del canario

### Email

- [ ] Crear un sender WIS aislado en n8n, sin reutilizar workflows de otros proyectos.
- [ ] Revalidar el acceso actual de Gmail/Brevo y confirmar que el alias `Ortu - WIS <ortu@wis-agency.com>` siga autorizado.
- [ ] Verificar `From`, `Reply-To` y la firma HTML WIS sin Gravatar mediante un envío interno de prueba.
- [ ] Validar SPF, DKIM y DMARC del dominio remitente.
- [ ] Confirmar que cada envío devuelva y persista el identificador real del proveedor.
- [ ] Conectar la escritura de eventos: intento, entrega, rebote, respuesta, baja y `OUTCOME_UNKNOWN`.
- [ ] Aplicar límites de 25 emails diarios, intervalos de 15 minutos y franja de 09:30 a 17:30 de Buenos Aires.

### WhatsApp

- [ ] Endurecer el workflow WIS 03 con idempotencia persistente y reconciliación antes de cualquier reintento.
- [ ] Confirmar que WIS 01/02/03 permanezcan separados de DUGAS y QH.
- [ ] Registrar la evidencia de opt-in con fuente y fecha; un número publicado no cuenta como consentimiento.
- [ ] Calcular la ventana de 24 horas desde el evento real de consentimiento o conversación.
- [ ] Obtener un snapshot de las plantillas aprobadas y validar cada `template_id` contra el proveedor.
- [ ] Conectar eventos de entrega, respuesta, baja, bloqueo y resultado incierto.
- [ ] Aplicar límites de 10 conversaciones iniciadas por día, intervalos de 15 minutos y un único follow-up aprobado.

## 2. Preparación del lote canario

- [ ] Auditar un lote de 25 prospectos de `Distribuidoras_300`.
- [ ] Confirmar empresa mediana o chica, contacto corporativo verificable y ausencia de duplicados.
- [ ] Analizar únicamente reseñas de 1, 2 y 3 estrellas e informar `analizadas/total accesible`.
- [ ] Redactar las variantes A/B siguiendo `OUTREACH_COPY_PLAYBOOK.md`.
- [ ] Ejecutar QA independiente sobre datos, problema elegido, personalización y tono.
- [ ] Seleccionar exactamente 5 destinatarios de email elegibles.
- [ ] Seleccionar hasta 2 destinatarios de WhatsApp únicamente si existe opt-in verificable.
- [ ] Crear los registros en `Outreach_Queue` sin realizar envíos.
- [ ] Registrar una aprobación humana que incluya lote, canal, versión, secuencia, vencimiento y límite de destinatarios.

## 3. Ejecución y validación del canario

- [ ] Enviar los 5 emails de forma individual y dentro de la cadencia aprobada.
- [ ] Enviar hasta 2 WhatsApp sólo si siguen siendo elegibles en el momento de ejecución.
- [ ] Verificar remitente, firma, formato, links, entrega y ausencia de mensajes duplicados.
- [ ] Conciliar cualquier timeout como `OUTCOME_UNKNOWN` antes de reintentar.
- [ ] Registrar respuestas, reuniones, rebotes, bajas y próxima acción.
- [ ] Pausar automáticamente ante error de autenticación, queja de spam o hard bounce superior al 2%.
- [ ] Hacer revisión humana de resultados antes de habilitar un nuevo lote.

## 4. Requisitos para escalar a lotes de 25

- [ ] Confirmar que el canario no produjo duplicados ni contactos simultáneos por ambos canales.
- [ ] Confirmar que las respuestas y bajas detienen las secuencias futuras.
- [ ] Validar los follow-ups de días 3 y 7 para email y un máximo de uno para WhatsApp.
- [ ] Definir un criterio mínimo de calidad por lote: datos verificables, copy aprobado y canal saludable.
- [ ] Mostrar en el dashboard entregados, rebotes, respuestas positivas, reuniones, bajas y casos inciertos.
- [ ] Mantener una aprobación por lote y por combinación exacta de canal, versión, secuencia, vencimiento y destinatarios autorizados.

## 5. Trabajo comercial pendiente

- [ ] Auditar y depurar las distribuidoras ya registradas como provisionales.
- [ ] Reemplazar corporaciones grandes, duplicados y prospectos sin encaje.
- [ ] Completar exactamente 300 distribuidoras argentinas medianas o chicas.
- [ ] Mantener las 12 columnas actuales de `Distribuidoras_300` sin agregar campos operativos.
- [ ] Al finalizar distribuidoras, iniciar 300 empresas logísticas de Latinoamérica con el mismo flujo.

## Criterio de “listo para operar”

El sistema puede considerarse listo para operación regular cuando:

1. Los cuatro bloqueos técnicos del dashboard estén cerrados.
2. El canario haya terminado sin duplicados ni resultados inciertos abiertos.
3. La salud de ambos canales esté validada.
4. Las pausas automáticas y las bajas hayan sido comprobadas.
5. Exista aprobación humana registrada para la combinación exacta de lote, canal, versión, secuencia, vencimiento y destinatarios.

Hasta entonces, el estado correcto es `DRY-RUN` y los envíos deben permanecer bloqueados.
