# Auditoría del canal WhatsApp WIS · 5679

Fecha: 2026-09-27  
Alcance: lectura de `wis-whatsapp-local` en el repositorio raíz y endurecimiento local versionado.  
Estado: **DESACTIVADO; cero mensajes enviados; cero workflows activados**.

## Dictamen

La implementación de referencia usa Baileys para la línea WIS prevista, por lo tanto es una conexión **no oficial**. El código fuente ya contiene varias defensas valiosas —SQLite local, flag de salida apagado por defecto, opt-in y baja, idempotencia genérica, lease único e identidad exacta—, pero no cumple por sí solo el contrato comercial de WIS. En particular, no exige la clave comercial canónica, QA independiente, aprobación de lote exacta, email primero, límite 10/día, cadencia de 15 minutos ni reconciliación durable con evidencia antes de un reintento ambiguo.

Se incorporó una barrera local independiente en `integrations/whatsapp/`, sin reutilizar ni modificar la carpeta no versionada auditada. La barrera queda desactivada y no contiene adaptador de transporte.

## Evidencia leída (sin secretos)

- `wis-whatsapp-local/local/schema.sql`: SQLite persiste contactos, consentimiento, bajas, operaciones e idempotency keys; `operations.status` contempla `outcome_unknown`.
- `wis-whatsapp-local/local/server.mjs`: `WIS_OUTBOUND_ENABLED` bloquea la cola por defecto; el API revalida consentimiento/baja y evita remover una baja sin revisión.
- `wis-whatsapp-local/local/worker.mjs`: el worker revalida consentimiento/baja, verifica identidad completa y mantiene un lease único; ante resultado ambiguo puede marcar `outcome_unknown`.
- `wis-whatsapp-local/docs/sqlite-local.md` y `docs/wis-local-runbook.md`: declaran el runtime local, el estado apagado y que Baileys no es oficial.
- El repositorio de referencia también contiene código Kapso/Cloud API para otro sector. No se tomó como transporte para WIS 5679 y no se inspeccionó ni modificó ningún workflow DUGAS o QH.

No se leyeron archivos `.env`, bases reales, sesiones Baileys, cookies, QR ni credenciales.

## Hallazgos y tratamiento

| Severidad | Hallazgo | Tratamiento versionado |
|---|---|---|
| Crítica | El API local acepta un `Idempotency-Key` libre, no necesariamente `prospect_key + campaign_id + channel + sequence`. | Clave canónica y fingerprint persistentes; replay idéntico y conflicto ante payload distinto. |
| Crítica | `OUTCOME_UNKNOWN` existe, pero el esquema auditado no exige un evento `RECONCILED` durable con fuente y evidencia antes de reintentar. | Reconciliación exclusiva desde `OUTCOME_UNKNOWN`; evidencia almacenada como hash y evento durable. |
| Alta | La referencia no aplica aprobación exacta de lote/canal/versión/secuencia ni QA independiente. | Gates obligatorios y comparación exacta de alcance y vencimiento. |
| Alta | No aplica email primero ni impide email/WhatsApp simultáneos. | Gates `email_initial_sent` y `email_channel_active`. |
| Alta | El worker drena de inmediato y no aplica el tope comercial 10/día ni 15 minutos. | Cómputo durable sobre eventos `SEND_CONFIRMED`: 10/día y 15 minutos. |
| Alta | El diseño de referencia es multi-sector y contiene sectores ajenos. | Binding estricto WIS/`wis-5679`; rechazo explícito DUGAS/QH. |
| Media | Baileys no ofrece plantillas oficiales y puede implicar suspensión de la línea. | Se declara no oficial; no se simulan plantillas. Fuera de 24 h se bloquea. |
| Media | La evidencia de baja o reconciliación podría contener datos sensibles. | Sólo se persiste su SHA-256, junto a fuente y fecha. |

## Estado de la implementación

- `channel.config.json`: `enabled=false`, `official_api=false`, transporte nominal `unofficial-baileys-local`.
- `channel.mjs`: ledger JSON atómico con lock, gates, idempotencia, bajas y reconciliación.
- `channel.test.mjs`: pruebas offline de aislamiento, replay/conflicto, opt-in, ventana de 24 h, bajas, `OUTCOME_UNKNOWN` y desactivación.
- `README.md`: contrato operativo y advertencia inequívoca de conexión no oficial.

La implementación no depende de plantillas oficiales. Como el transporte no oficial no puede emitirlas legítimamente, cualquier contacto fuera de la ventana de 24 horas queda bloqueado con `SERVICE_WINDOW_EXPIRED`; no se emula ni etiqueta un texto libre como plantilla.

## Pendientes antes de cualquier canario real

1. Revisión independiente de QA sobre este cambio.
2. Definir el storage operativo protegido y su backup; el ledger de prueba no debe contener secretos.
3. Implementar un adaptador Baileys separado que consuma únicamente registros aprobados, manteniendo la doble revalidación en el instante de envío.
4. Verificar manualmente la identidad E.164 completa de la cuenta; el sufijo `5679` no basta.
5. Aprobar explícitamente el canario exacto y, por separado, la activación del canal/worker.
6. Reconciliar el proveedor y reconstruir el índice durable antes de cada claim.

Hasta completar esos pasos, el estado correcto es `WAITING_APPROVAL` y el canal debe permanecer desactivado.
