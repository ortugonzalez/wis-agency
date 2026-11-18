# WIS Command Center

Consola comercial local para trabajar sin volver a la planilla: lectura de prospectos, búsqueda y filtros, análisis, copiado de contactos, revisión de borradores, envío confirmado y actividad consolidada.

## Experiencia

- `PROSPECTOS` se presenta como directorio filtrable y conserva las 12 columnas comerciales; el ID técnico permanece oculto en M.
- La ficha lateral reúne contacto, reseñas 1–3 estrellas, análisis y los dos mensajes.
- Email y teléfono se copian con un clic.
- Cada envío requiere un segundo clic humano, se valida del lado del servidor y usa una clave idempotente.
- El clic no reemplaza la gobernanza: también exige QA independiente, aprobación de lote vigente y snapshots durables de cola/proveedor.
- WhatsApp exige teléfono internacional explícito, email inicial previo y evidencia de opt-in.
- Los resultados inciertos se registran como `OUTCOME_UNKNOWN`; no se reintentan automáticamente.
- El navegador mantiene un canal SSE con el servidor y conserva un refresco de respaldo cada 30 segundos.

## Inicio

Desde la raíz:

```powershell
rtk npm run dashboard:start
```

Abrir `http://127.0.0.1:4174/#prospects`.

Antes de desplegar o habilitar canales, ejecutar:

```powershell
rtk node ops/reports/web/wis-operations-dashboard/check-production-readiness.mjs
```

El reporte enumera faltantes sin mostrar valores de secretos. La plantilla completa para EasyPanel está en `.env.production.example`; todos los flags de salida y escritura permanecen desactivados por defecto.

Los flags `*_PASSED` no ejecutan una prueba ni autorizan una acción: registran que existe evidencia durable revisada. Sólo deben pasar a `true` después de completar el control correspondiente. Readiness exige, además de credenciales y endpoints, QA del release, sincronización Sheets E2E, texto/audio/QA de Telegram, buzón Microsoft 365, aplicación Entra, consentimiento Graph, DNS/semillas/QA de email y webhook/rollback/QA de WhatsApp. Activar flags de salida sin esos controles mantiene el sistema en `ready=false`.

## Google Sheets en vivo

El servicio puede leer directamente las planillas comercial y operativa con una cuenta de servicio. La planilla comercial se comparte como lectora y la operativa como editora. Los comandos del panel, la cola y los eventos se escriben únicamente en la planilla operativa.

Variables:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64`
- `WIS_COMMERCIAL_SHEET_ID`
- `WIS_COMMERCIAL_SHEET_NAME=PROSPECTOS`
- `WIS_OPERATIONS_SHEET_ID`
- `WIS_SHEETS_REFRESH_SECONDS=30`
- `WIS_SHEETS_WRITES_ENABLED=true`
- `WIS_SHEETS_CHANGE_TOKEN` — secreto compartido para la notificación de cambios desde Apps Script.

La clave privada nunca se guarda en Git ni se entrega al navegador. Sin escritura habilitada, el panel continúa en modo lectura y los envíos siguen bloqueados.

El archivo comercial unificado aporta `PROSPECTOS`, `SEGUIMIENTO`, `BAJAS` y `MÉTRICAS`. El estado técnico durable (QA, aprobaciones, cola, eventos y evidencia de reseñas) sigue en `WIS · Operaciones de Agentes`: no se mezcla con las 12 columnas comerciales.

Para cambios hechos directamente en Google Sheets, el trigger instalable de `integrations/google-sheets/dashboard-sync.gs` notifica al endpoint firmado `/api/sheets/notify`; el servidor relee la planilla y avisa al navegador por SSE. Si el trigger todavía no fue instalado, el refresco de 30 segundos actúa como respaldo. Instalar el trigger, configurar el secreto o desplegar el servicio requiere aprobación humana.

## Centro de costos

- `Cost_Ledger` conserva cada consumo con operación, prospecto, etapa, proveedor, modelo, tokens, unidades y costo.
- `Cost_Settings` conserva presupuesto y costos fijos mensuales.
- `POST /api/costs/usage` recibe telemetría del ejecutor de research/copy y deduplica por `idempotencyKey`.
- Si el proveedor informa el costo real, ese valor tiene prioridad. Si no, se aplica la tabla versionada de `costs.mjs`.
- Research, borradores y envíos registran su operación automáticamente; las simulaciones nunca se guardan como gasto.
- `WIS_COST_INGEST_TOKEN` puede exigir un token adicional a los workers, además de la autenticación del panel.

## Envío de email

Variables del proceso local:

- `WIS_EMAIL_PROVIDER=wis_mailer`
- `WIS_EMAIL_SENDER=ortu@wis-ia.com`
- `WIS_EMAIL_ENQUEUE_URL`
- `WIS_EMAIL_API_TOKEN`
- `WIS_EMAIL_MAILBOX_VERIFIED=true`
- `WIS_EMAIL_ENTRA_APP_VERIFIED=true`
- `WIS_EMAIL_GRAPH_ADMIN_CONSENTED=true`
- `WIS_EMAIL_DNS_VERIFIED=true`
- `WIS_EMAIL_SEED_TESTS_PASSED=true`
- `WIS_EMAIL_QA_PASSED=true`
- `WIS_MAILER_OUTBOUND_ENABLED=true`
- `WIS_EMAIL_OUTBOUND_ENABLED=true`

El adaptador recibe un destinatario individual, asunto, cuerpo, identidad WIS y clave idempotente. La configuración permanece bloqueada si falta cualquiera de las variables o si el proveedor/remitente no coincide exactamente.

La única ruta activa prevista es `Dashboard → WIS Mailer → Microsoft Graph / Microsoft 365`, con `Ortu - WIS <ortu@wis-ia.com>`. Instantly, Brevo, Gmail manual y n8n quedan fuera de la ruta activa. El buzón, la aplicación Entra, el consentimiento administrativo, el worker y el tracking propio continúan pendientes de alta y aprobación humana. Los secretos de Entra viven sólo en el WIS Mailer; el dashboard recibe únicamente attestations booleanas y el token de su endpoint.

## Evidencia de reseñas

`Review_Evidence` exige URL exacta de Maps, ficha verificada, Reseñas/Opiniones abiertas, orden de peor valoración, cantidades, fecha y hash. Un fallo de acceso queda pendiente. Un recorrido directo sin reseñas 1–3★ puede registrarse operativamente como `VERIFIED_NO_LOW_REVIEWS`, pero no escribe `0/0` en `PROSPECTOS` ni habilita copy o envío basado en problemas.

## Envío de WhatsApp

Variables del proceso local:

- `WIS_WHATSAPP_WEBHOOK_URL` — workflow WIS exclusivo para la línea 5679
- `WIS_WHATSAPP_WEBHOOK_TOKEN`
- `WIS_WHATSAPP_TRANSPORT=unofficial-baileys-local`
- `WIS_WHATSAPP_TRANSPORT_APPROVED=true` — aceptación humana separada del riesgo del transporte
- `WIS_WHATSAPP_WEBHOOK_QA_PASSED=true`
- `WIS_WHATSAPP_ROLLBACK_VERIFIED=true`
- `WIS_WHATSAPP_OUTBOUND_ENABLED=true`

Las cinco condiciones son acumulativas. Identificar el transporte no lo aprueba y aprobar el transporte no habilita envíos ni sustituye la aprobación exacta del lote. El adaptador sólo acepta el workflow WIS de la conexión terminada en 5679. No toca DUGAS, QH ni otros sectores.

La identidad de la línea terminada en 5679 fue verificada nuevamente y la sesión está conectada. Los envíos continúan pausados hasta registrar y activar, con aprobación específica, el webhook exclusivo hacia `/api/providers/whatsapp/events`, cargar su secreto fuera de Git y disponer de QA independiente, aprobación exacta del lote, email previo y opt-in verificable.

## Contrato de aprobación

El snapshot operativo acepta `qa`, `approvals`, `outreachQueue` y `providerReconciliationLoaded`. La aprobación debe contener lote, campaña, canal, versión, secuencia, destinatarios, límite y vencimiento exactos. La clave se construye como `prospect_key|campaign_id|channel|sequence`.

## Seguridad

En local el servidor escucha en `127.0.0.1`. En producción usa autenticación Basic con contraseña hasheada, HTTPS del proxy y validación estricta de mismo origen. `WIS_ALLOW_REMOTE_MUTATIONS=true` habilita los botones autenticados; no elimina QA, aprobación, consentimiento ni reconciliación. Los destinatarios siempre se derivan del Sheet y los eventos se registran de forma durable. El dashboard no contiene tokens, cookies ni contraseñas.
