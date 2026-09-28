# WIS Command Center

Panel privado de operaciones comerciales desplegable como servicio separado dentro del proyecto `wis` de EasyPanel.

## Conexiones

El servicio lee cada 30 segundos:

- `Distribuidoras_300` desde la planilla comercial.
- `Outreach_Queue`, `Outreach_Events`, `Approvals`, `Runs`, `Task_Commands`, `Channel_Health`, `Cost_Ledger` y `Cost_Settings` desde la planilla operativa.

El Centro de Costos registra consumos medidos por operación, admite costos informados por proveedor, calcula tarifas versionadas cuando falta una factura y mantiene separados los valores reales de las simulaciones.

- `Cost_Ledger` conserva operación, prospecto, etapa, proveedor, modelo, tokens, unidades y costo.
- `Cost_Settings` conserva presupuesto y costos fijos mensuales.
- `POST /api/costs/usage` recibe telemetría del ejecutor y deduplica por `idempotencyKey`.
- `WIS_COST_INGEST_TOKEN` permite exigir una credencial adicional a los workers.

La lectura utiliza una cuenta de servicio de Google. La planilla comercial se comparte como lectora y la operativa como editora para registrar comandos, cola y eventos. La clave nunca se guarda en Git.

## Variables obligatorias

```text
WIS_REQUIRE_AUTH=true
WIS_DASHBOARD_USERNAME=<usuario>
WIS_DASHBOARD_PASSWORD_SHA256=<sha256 de la contraseña>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<cuenta de servicio>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64=<clave privada PEM en base64>
WIS_SHEETS_WRITES_ENABLED=true
WIS_ALLOW_REMOTE_MUTATIONS=true
```

## Variables de control

```text
WIS_COMMERCIAL_SHEET_ID=1HoVbDf_In8urKkiUnfkE-j3TPq0vrI4pjfPoAYKJYl8
WIS_OPERATIONS_SHEET_ID=1oJxHk_FeDiZ3FUi3ugd2xheiJSrA9OgdRQn5EJgpN_w
WIS_SHEETS_REFRESH_SECONDS=30
WIS_PROVIDER_RECONCILIATION_TRUSTED=false
```

Los botones autenticados pueden actualizar Sheets, pero los adaptadores de email y WhatsApp permanecen bloqueados hasta configurar sus webhooks exclusivos, aprobar la firma y superar los gates de QA, aprobación, consentimiento e idempotencia.

## EasyPanel

- Repositorio: `ortugonzalez/wis-agency`
- Rama: `main`
- Ruta de compilación: `/command-center`
- Puerto: `4174`
- Health check: `/health`
- Persistencia recomendada: `/app/runtime`
