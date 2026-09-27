# WIS email sender (desactivado)

Implementación local y versionada del canal de email WIS. No instala, activa ni modifica nada en n8n, Gmail o Brevo.

## Contenido

- `config.disabled.json`: configuración segura por defecto. El alias WIS fue revalidado en Gmail el 27/09/2026; la firma y el transporte siguen pendientes.
- `config.schema.json`: contrato estricto de configuración.
- `runtime.mjs`: preflight y construcción offline de un único sobre, sin transporte de red.
- `health-check.mjs`: auditoría pública de DNS y, sólo con `--live-read-only`, inventario GET de n8n/Brevo. Nunca imprime credenciales.
- `workflows/wis-email-sender.disabled.json`: export n8n inactivo, con trigger manual, hard gate y nodo Gmail también desactivado.
- `test/email-sender.test.mjs`: controles offline de fail-closed, idempotencia, copy, firma, alias y ausencia de CC/BCC.

## Comandos seguros

```powershell
rtk node --test integrations/email/test/email-sender.test.mjs
rtk node integrations/email/health-check.mjs
```

Para una auditoría autenticada exclusivamente de lectura, puede indicarse un archivo local fuera del repositorio. El script usa sólo `GET` y devuelve un resumen sin IDs ni valores de credenciales:

```powershell
rtk node integrations/email/health-check.mjs --live-read-only --env-file C:\ruta\privada\.env
```

## Activación

No editar los tres bloqueos como parte de una prueba. El paso a canario requiere, como cambios revisados por separado: alias verificado, firma aprobada con hash, credencial WIS exclusiva, snapshots durables de cola y proveedor, QA independiente y aprobación humana vigente para el lote exacto. Recién entonces se puede generar otro export; este archivo debe conservarse como baseline desactivada.
