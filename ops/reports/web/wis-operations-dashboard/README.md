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

El runtime lee `ops/runtime/dashboard-sheet-snapshot.json`. Un adaptador autenticado puede actualizarlo mediante:

```text
POST /api/snapshots/sheets
X-WIS-Dashboard-Token: <WIS_DASHBOARD_INGEST_TOKEN>
```

También puede configurarse `WIS_SHEETS_PROXY_URL` y, opcionalmente, `WIS_SHEETS_PROXY_TOKEN`; el botón “Actualizar desde Sheets” consultará ese proxy. No se guardan credenciales en Git ni en el navegador.

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

El servidor escucha sólo en `127.0.0.1`, valida origen para mutaciones, deriva destinatarios desde el snapshot del Sheet y guarda eventos append-only en `ops/runtime/dashboard-outreach-events.ndjson`. El dashboard no contiene tokens, cookies ni contraseñas.
