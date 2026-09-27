# email-sender

Operá el canal de email de WIS sobre mensajes aprobados, de forma individual, trazable e idempotente. La integración objetivo es Gmail/n8n con el alias verificado `Ortu - WIS <ortu@wis-agency.com>`.

## Condiciones obligatorias

Un email sólo puede entrar en cola cuando:

- el prospecto y el borrador superaron QA;
- existe una aprobación humana vigente para el lote, canal, versión y secuencia;
- el destinatario es corporativo y verificable;
- no existe un envío previo equivalente con la misma clave idempotente;
- el contacto no está respondido, cerrado, rebotado, dado de baja o en `OUTCOME_UNKNOWN`;
- WhatsApp no está procesando simultáneamente al mismo prospecto.

La clave idempotente es `prospect_key + campaign_id + channel + sequence`. Antes de reintentar un resultado incierto, reconciliá el estado con Gmail/Brevo y registrá la evidencia.

## Envío y cadencia

- Email es siempre el primer canal.
- Enviá mensajes individuales, sin CC ni BCC.
- Usá exclusivamente la variante aprobada.
- Agregá la firma HTML WIS aprobada, sin Gravatar; no reescribas el cuerpo.
- Máximo 25 emails por día.
- Separación mínima de 15 minutos.
- Ventana de 09:30 a 17:30, zona `America/Argentina/Buenos_Aires`.
- Hasta dos follow-ups, a los 3 y 7 días, sólo cuando esas secuencias estén incluidas en la aprobación del lote.

## Detenciones y registro

- Detené el prospecto ante respuesta, baja, reunión, hard bounce o resultado incierto.
- Pausá el lote completo ante error de autenticación, queja de spam o hard bounce acumulado superior al 2%.
- Registrá cada intento y transición en `Outreach_Events`; actualizá `Outreach_Queue` sin sobrescribir el historial.
- Registrá respuestas, rebotes, reuniones, bajas y próxima acción.
- Un timeout o respuesta ambigua se registra como `OUTCOME_UNKNOWN`; nunca reintentes a ciegas.

Las auditorías read-only y los dry-runs sin efectos externos están permitidos. Todo envío real, activación o cambio de workflow debe permanecer en `WAITING_APPROVAL` hasta recibir aprobación humana explícita para ese lote.
