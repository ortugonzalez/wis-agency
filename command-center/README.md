# WIS Command Center

Consola comercial local para trabajar sin volver a la planilla: lectura de prospectos, búsqueda y filtros, análisis, copiado de contactos, revisión de borradores, envío confirmado y actividad consolidada.

## Experiencia

- `Distribuidoras_300` y `Hoteles_Argentina_300` se presentan como directorios filtrables por campaña.
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

## Campaña Hoteles de Argentina

La campaña `hoteles-argentina-300` trabaja en fase `contacts`: conserva las 12 columnas comerciales, pero sólo puede escribir `Rubro`, `Empresa`, `Ubicación`, `WhatsApp`, `Web`, `Email` y `Rating`. Las columnas H:L quedan vacías y el servidor rechaza cualquier intento de redactar o enviar desde esta campaña.

El ejecutor procesa como máximo 25 hoteles por lote, nunca supera 300 filas y deduplica por Place ID, dominio, email, teléfono y nombre/ubicación. Sólo admite email publicado y WhatsApp explícito (`wa.me`, `api.whatsapp.com` o etiqueta equivalente). Las cadenas excluidas y los candidatos sin operación profesional, sin 20 reseñas o sin contacto verificable quedan en `Research_Evidence`.

Variables exclusivas del ejecutor:

- `WIS_RESEARCH_EXECUTOR_ENABLED=true`
- `GOOGLE_MAPS_API_KEY`
- `WIS_GOOGLE_USAGE_OBSERVED_AT` — ISO 8601; debe tener menos de seis horas.
- `WIS_GOOGLE_USAGE_TEXT_SEARCH_PRO` — consumo mensual total observado en Google Cloud.
- `WIS_GOOGLE_USAGE_PLACE_DETAILS_ENTERPRISE` — consumo mensual total observado en Google Cloud.

El proceso debe desplegarse con una sola réplica. El bloqueo en memoria evita dos lotes simultáneos de la campaña y el ledger durable reserva cada unidad antes de llamar a Google. Si falta la clave, la observación está vencida o el margen gratuito no alcanza, el lote queda `BLOCKED` antes de la llamada. No se interpreta una alerta presupuestaria como corte de gasto.

Para activar un lote real:

1. Confirmar en Google Cloud el consumo mensual de ambos SKU y cargar el snapshot fechado.
2. Mantener `zeroCostMode=true`; no existe control de interfaz para desactivarlo.
3. Iniciar la campaña desde Research. El primer lote queda en `REVIEW` después de un máximo de 25 altas.
4. QA verifica independencia, contacto, duplicados y costo antes de continuar.

La búsqueda gratuita por navegador o registros públicos queda indicada como fallback cuando Google no puede usarse, pero no se convierte silenciosamente en una llamada paga.

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
- `WIS_EMAIL_ALLOWED_APPROVAL_IDS=APR-...` — lista blanca obligatoria de aprobaciones exactas; separar varias con coma.

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
