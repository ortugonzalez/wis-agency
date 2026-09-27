# Operación comercial multiagente WIS

## Objetivo

Mantener cuatro carriles comerciales ocupados sin superponer filas ni canales:

1. `prospect-research` prepara el lote N.
2. `outreach-copy` redacta el lote N-1 ya validado.
3. `email-sender` procesa el lote N-2 aprobado.
4. `whatsapp-sender` procesa únicamente contactos con opt-in del lote N-2 o anterior.

`qa-ops` controla transiciones; no investiga, redacta ni envía. `wis-orchestrator` asigna lotes y registra aprobaciones.

## Fuentes de verdad

- Repositorio: roles, política, contratos, pruebas y runbooks.
- `WIS · Operaciones de Agentes`: `Backlog`, `Runs`, `Approvals`, `Handoffs_Incidents`, `Outreach_Queue` y `Outreach_Events`.
- Planilla comercial: sólo las 12 columnas existentes de `Distribuidoras_300`.
- Proveedores de canal: estado de entrega y respuesta, reconciliado en eventos.

## Lotes y propiedad

- Tamaño normal: 25 prospectos.
- Cada fila tiene un único propietario por etapa.
- Cada mensaje tiene `prospect_key`, `campaign_id`, `batch_id`, canal, secuencia y versión.
- La clave `prospect_key|campaign_id|channel|sequence` debe ser inédita en la cola y en el proveedor. El sender reconstruye ese índice durable antes de cada lote.
- El sender no cambia el copy aprobado; sólo agrega firma y metadatos de canal.

## Aprobación por lote

Una aprobación válida fija lote, campaña, canales, versiones, secuencias, cantidad máxima, vencimiento y evidencia de QA. Sin coincidencia exacta, el mensaje permanece en `ESPERANDO_APROBACION`.

Canario inicial:

- 5 emails individuales.
- 0–2 WhatsApp, sólo si existe opt-in verificable.
- Ningún contacto recibe ambos canales en simultáneo.

## Email

- Gmail/Brevo con alias verificado `Ortu - WIS <ortu@wis-agency.com>`.
- 25 por día, uno cada 15 minutos, 09:30–17:30 Buenos Aires.
- Follow-ups en días 3 y 7 sólo si la aprobación los incluye.
- Sin CC/BCC. Firma HTML WIS sin Gravatar.
- Respuesta, baja, reunión, hard bounce u outcome incierto detienen la secuencia.

## WhatsApp

- Email primero; WhatsApp sólo después de que el prospecto lo inicia o entrega consentimiento verificable.
- Fuera de la ventana de 24 horas se exige una plantilla aprobada.
- 10 conversaciones por día, una cada 15 minutos, máximo un follow-up aprobado.
- Usar únicamente el carril WIS Kapso-MundoVera. DUGAS y QH están fuera de alcance.
- Los workflows permanecen inactivos hasta auditoría, dry-run y canario aprobado.

## Recuperación e incidentes

- `OUTCOME_UNKNOWN`: bloquear reintento, consultar proveedor, registrar reconciliación y recién después decidir.
- Error de autenticación o queja de spam: pausar el lote completo.
- Hard bounce superior al 2%: pausar lote/canal y auditar destinatarios.
- Opt-out o bloqueo: detener toda secuencia futura del prospecto.
- Error de fila o conflicto de propiedad: pasar a `BLOQUEADO` y devolver al orquestador.
- Cada consentimiento, intento, respuesta, rebote, baja, reunión y recuperación se agrega a `Outreach_Events`; no se reescribe historia. El consentimiento conserva fuente, fecha y template aplicable.

## Secuencia de habilitación

1. Validar contratos y simulación local de 25 fixtures.
2. Auditar Gmail/Brevo y workflows WIS en lectura.
3. Reemplazar proveedores por stubs en el dry-run.
4. Ejecutar QA independiente.
5. Solicitar aprobación humana del canario.
6. Enviar sólo después de registrar la aprobación.
7. Reconciliar resultados antes de habilitar lotes normales.

## Comandos

```powershell
rtk npm test
rtk npm run outreach:dry-run
```

Estas pruebas no realizan llamadas a proveedores ni envían mensajes.
