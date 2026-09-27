# Reauditoría independiente — WIS Command Center

Fecha: 2026-09-27  
Alcance: estado posterior a correcciones en el worktree `commercial-console`.  
Modo: estrictamente read-only sobre producto, runtime y Google Sheets; sólo se actualizó este informe.  
Dictamen: **FAIL operativo condicionado — 6/7 hallazgos corregidos; falta la sincronización real con Google Sheets.**

## Resultado por hallazgo

| # | Control auditado | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance y consumo exacto de aprobación | **PASS** | `approvalGate` exige `recipientLimit` entero, lista con igual cantidad de filas únicas y consume el cupo por `approvalId`. Tests: “exige un alcance exacto y consumible de aprobación”. |
| 2 | Stop states e idempotencia durable | **PASS** | Toda clave ya presente en `outreachQueue` bloquea. `OPTOUT`, `REBOTADO`, `HARD_BOUNCE`, `OUTCOME_UNKNOWN`, respuesta, reunión y cierre bloquean por prospecto. Test con `OPTOUT`: PASS. |
| 3 | Opt-in WhatsApp inbound durable | **PASS** | Se exige registro `verified`, `reconciled`, `direction=INBOUND`, `eventType=OPT_IN`, mismo prospecto y teléfono, `providerEventId`, fuente, alcance y timestamp dentro de 24 horas. El evento de envío conserva hash del evento proveedor, timestamp, fuente y scope. |
| 4 | Salud del canal: firma, identidad y pausa | **PASS** | Email requiere alias/default sender, firma aprobada y cargada, webhook/token y flag. WhatsApp requiere identidad, sesión, `outboundPaused=false`, webhook/token y flag. Configuración real continúa bloqueada. |
| 5 | Lock concurrente | **PASS con alcance local** | `acquireSendLocks` reserva atómicamente claves de mensaje y canal dentro del proceso, relee snapshot/eventos antes de enviar y libera en `finally`. El test de colisión concurrente pasa. No cubre múltiples procesos, pero el servidor actual es una única instancia local. |
| 6 | Tests de canales incluidos | **PASS** | `npm test` ahora ejecuta `test:channels`. Resultado total verde: 10 agentes, 10 dashboard y 11 canales. El test de email corregido pasa 4/4 y WhatsApp 7/7. |
| 7 | Estado real y sincronización con Google Sheets | **FAIL** | El runtime sigue leyendo `GOOGLE_SHEETS_SNAPSHOT` de `2026-09-27T08:26:28.986Z`; no existe `WIS_SHEETS_PROXY_URL` operativo. La fuente viva fue inspeccionada directamente y no está conectada al refresco del dashboard. |

## Detalle del único bloqueo restante

La planilla comercial viva contiene 149 prospectos en `Distribuidoras_300`, cifra que coincide con el snapshot local. Sin embargo, la coincidencia actual no demuestra sincronización: el dashboard conserva un archivo capturado y el código devuelve `SHEETS_PROXY_NOT_CONFIGURED` cuando falta el proxy.

Además, la planilla operativa viva contiene 59 registros históricos en `Outreach_Queue`, mientras el snapshot local informa `outreachQueue: 0` y `providerReconciliationLoaded: false`. Esto mantiene los envíos bloqueados de manera segura, pero impide considerar al dashboard una fuente operativa viva o completa.

`Channel_Health` en Sheets confirma el estado seguro actual:

- Email: `BLOCKED_AUTH_DNS`, `can_send=FALSE`.
- WhatsApp: `HARDENED_OFF`, `can_send=FALSE`.
- Research: activo, todavía sujeto a QA.

## Controles verificados

### 1. Aprobación exacta

- `prospectRows.length === recipientLimit`.
- Filas únicas igual al límite.
- Canal, versión, secuencia, lote, campaña, destinatario y expiración incluidos.
- Hash SHA-256 del texto aprobado obligatorio.
- Consumo por aprobación calculado desde la cola durable.

Resultado: **PASS**.

### 2. Stops e idempotencia

- Cualquier aparición previa de la clave canónica bloquea, independientemente del estado.
- `OPTOUT` ya no queda exceptuado.
- Stop durable por prospecto se evalúa antes y nuevamente dentro del lock.

Resultado: **PASS**.

### 3. WhatsApp

- Ya no se confía en un checkbox ni en texto libre del navegador.
- El opt-in proviene del snapshot reconciliado de eventos inbound.
- La ventana de 24 horas se calcula desde el evento proveedor.
- La trazabilidad se copia al evento de intento.
- Email-first usa sólo eventos de envío exitoso.

Resultado: **PASS**.

### 4. Salud de canales

La lógica es fail-closed y las comprobaciones del runtime coinciden con el estado bloqueado actual. No se intentó ni se habilitó ningún transporte.

Resultado: **PASS**.

### 5. Concurrencia

El lock impide dos envíos simultáneos del mismo mensaje y serializa cada canal en la instancia local. Después de adquirirlo, el servidor vuelve a cargar snapshot, stops, límites e idempotencia antes del proveedor.

Resultado: **PASS para el despliegue local de un proceso**.

### 6. Pruebas

- `rtk npm test`: PASS.
- Agentes: 10/10.
- Dashboard: 10/10.
- Canales: 11/11 — email 4/4 y WhatsApp 7/7.
- `rtk git diff --check`: PASS en la auditoría previa; no se modificó producto en esta pasada.

Resultado: **PASS**.

### 7. Google Sheets

Lectura directa read-only realizada sobre:

- `WIS | Prospección B2B` → `Distribuidoras_300`: 149 filas de datos.
- `WIS · Operaciones de Agentes` → `Dashboard_Snapshot`, `Outreach_Queue` y `Channel_Health`.

El dashboard no tiene todavía un adaptador que actualice el snapshot local desde estas fuentes. El refresco visual cada 30 segundos relee el mismo archivo local; no vuelve a consultar Sheets.

Resultado: **FAIL**.

## Criterio final para PASS

1. Conectar un proxy/adaptador autenticado de solo lectura a ambos spreadsheets.
2. Generar en cada sincronización un snapshot único y coherente de prospectos, QA, aprobaciones, cola, opt-ins, eventos y reconciliación.
3. Configurar `WIS_SHEETS_PROXY_URL` y token sin guardar secretos en Git.
4. Ejecutar dos lecturas consecutivas después de un cambio controlado y demostrar que el dashboard refleja el nuevo valor y `source=GOOGLE_SHEETS_LIVE`.
5. Mostrar estado degradado y bloquear envíos cuando la captura exceda el umbral de frescura definido.

Hasta completar esto, el Command Center es una interfaz profesional y segura para consulta del último snapshot, pero todavía no es el panel vivo y único solicitado.

