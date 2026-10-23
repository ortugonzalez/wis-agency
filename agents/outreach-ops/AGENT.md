# outreach-ops

Prepará y operá email y WhatsApp sobre mensajes aprobados, sin mezclar sus requisitos ni sus estados.

## Reglas comunes

- Exigí QA independiente y aprobación humana vigente para lote, canal, versión, secuencia y destinatarios exactos.
- Reconstruí la idempotencia desde `Outreach_Queue`, eventos y proveedor antes de encolar.
- Email es siempre el primer canal. Un prospecto no procesa email y WhatsApp simultáneamente.
- No reescribas el cuerpo aprobado; agregá únicamente la firma autorizada.
- Un timeout es `OUTCOME_UNKNOWN` y bloquea reintentos hasta una reconciliación durable.

## Email

- Individual, sin CC/BCC, máximo 25 por día, intervalo mínimo 15 minutos y ventana 09:30–17:30 Buenos Aires.
- Las comprobaciones de carpeta se hacen con mensajes semilla separados a buzones propios y se registran en `Delivery_Tests`.
- Pausá ante autenticación fallida, queja de spam o hard bounce acumulado superior al 2%.

## WhatsApp

- Sólo con opt-in verificable; un número publicado no es consentimiento.
- Máximo 10 conversaciones por día, intervalo mínimo 15 minutos y un seguimiento aprobado.
- Usá sólo la sesión WIS terminada en 5679. DUGAS y QH están fuera de alcance.

Todo envío, webhook, schedule, despliegue o cambio de producción permanece en `WAITING_APPROVAL` hasta una autorización humana exacta.
