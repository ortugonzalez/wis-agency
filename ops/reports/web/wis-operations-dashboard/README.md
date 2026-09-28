# WIS Command Center

Consola comercial local para trabajar sin volver a la planilla: lectura de prospectos, búsqueda y filtros, análisis, copiado de contactos, revisión de borradores, envío confirmado y actividad consolidada.

## Experiencia

- `Distribuidoras_300` se presenta como directorio filtrable.
- La ficha lateral reúne contacto, reseñas 1–3 estrellas, análisis y los dos mensajes.
- Email y teléfono se copian con un clic.
- Cada envío requiere un segundo clic humano, se valida del lado del servidor y usa una clave idempotente.
- El clic no reemplaza la gobernanza: también exige QA independiente, aprobación de lote vigente y snapshots durables de cola/proveedor.
- WhatsApp exige teléfono internacional explícito, email inicial previo y evidencia de opt-in.
- Los resultados inciertos se registran como `OUTCOME_UNKNOWN`; no se reintentan automáticamente.
- El navegador refresca el estado local cada 30 segundos.

## Inicio

Desde la raíz:

```powershell
rtk npm run dashboard:start
```

Abrir `http://127.0.0.1:4174/#prospects`.

## Google Sheets en vivo

El servicio puede leer directamente las planillas comercial y operativa con una cuenta de servicio. La planilla comercial se comparte como lectora y la operativa como editora. Los comandos del panel, la cola y los eventos se escriben únicamente en la planilla operativa.

Variables:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64`
- `WIS_COMMERCIAL_SHEET_ID`
- `WIS_OPERATIONS_SHEET_ID`
- `WIS_SHEETS_REFRESH_SECONDS=30`
- `WIS_SHEETS_WRITES_ENABLED=true`

La clave privada nunca se guarda en Git ni se entrega al navegador. Sin escritura habilitada, el panel continúa en modo lectura y los envíos siguen bloqueados.

## Centro de costos

- `Cost_Ledger` conserva cada consumo con operación, prospecto, etapa, proveedor, modelo, tokens, unidades y costo.
- `Cost_Settings` conserva presupuesto y costos fijos mensuales.
- `POST /api/costs/usage` recibe telemetría del ejecutor de research/copy y deduplica por `idempotencyKey`.
- Si el proveedor informa el costo real, ese valor tiene prioridad. Si no, se aplica la tabla versionada de `costs.mjs`.
- Research, borradores y envíos registran su operación automáticamente; las simulaciones nunca se guardan como gasto.
- `WIS_COST_INGEST_TOKEN` puede exigir un token adicional a los workers, además de la autenticación del panel.

## Envío de email

Variables del proceso local:

- `WIS_EMAIL_WEBHOOK_URL`
- `WIS_EMAIL_WEBHOOK_TOKEN`
- `WIS_EMAIL_OUTBOUND_ENABLED=true`

El webhook recibe un destinatario individual, asunto, cuerpo, identidad WIS y clave idempotente. La configuración permanece bloqueada si falta cualquiera de las tres variables.

El alias `Ortu - WIS <ortu@wis-agency.com>` fue revalidado como remitente predeterminado en Gmail y usa el relay TLS de Brevo. Esto verifica identidad, no habilita automáticamente el transporte del dashboard.

## Envío de WhatsApp

Variables del proceso local:

- `WIS_WHATSAPP_WEBHOOK_URL` — workflow WIS exclusivo para la línea 5679
- `WIS_WHATSAPP_WEBHOOK_TOKEN`
- `WIS_WHATSAPP_OUTBOUND_ENABLED=true`

El adaptador sólo acepta el workflow WIS de la conexión terminada en 5679. No toca DUGAS, QH ni otros sectores.

La identidad `5491130035679` y su sesión persistente fueron verificadas como conectadas. Los envíos continúan pausados hasta disponer de token mínimo, QA, aprobación, email previo y opt-in.

## Contrato de aprobación

El snapshot operativo acepta `qa`, `approvals`, `outreachQueue` y `providerReconciliationLoaded`. La aprobación debe contener lote, campaña, canal, versión, secuencia, destinatarios, límite y vencimiento exactos. La clave se construye como `prospect_key|campaign_id|channel|sequence`.

## Seguridad

En local el servidor escucha en `127.0.0.1`. En producción usa autenticación Basic con contraseña hasheada, HTTPS del proxy y validación estricta de mismo origen. `WIS_ALLOW_REMOTE_MUTATIONS=true` habilita los botones autenticados; no elimina QA, aprobación, consentimiento ni reconciliación. Los destinatarios siempre se derivan del Sheet y los eventos se registran de forma durable. El dashboard no contiene tokens, cookies ni contraseñas.
