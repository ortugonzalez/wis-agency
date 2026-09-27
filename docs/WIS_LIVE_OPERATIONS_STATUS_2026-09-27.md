# WIS · Estado operativo unificado

Fecha de corte: 27 de septiembre de 2026  
Modo: `DRY_RUN` para nuevos envíos

## Resultado de esta iteración

El sistema comercial quedó concentrado en un dashboard local y en la planilla `WIS · Operaciones de Agentes`. No se realizó ningún envío nuevo.

- Se importaron 59 registros del historial de email a `Outreach_Queue`.
- Se reconstruyeron 52 eventos en `Outreach_Events`: 50 envíos, un rebote blando y un duplicado omitido.
- Se crearon `Dashboard_Snapshot`, `Automation_Control`, `Task_Commands` y `Channel_Health`.
- Se construyó un sender WIS aislado para email, desactivado y fail-closed.
- Se endureció el canal WhatsApp no oficial para la línea terminada en 5679.
- Se auditó el primer lote de 25 distribuidoras: 0 PASS, 8 REVIEW y 17 DISCARD.
- Se agregaron botones para research, QA, copy y actualización; registran órdenes idempotentes y no envían mensajes.
- Se prepararon cuatro programaciones, todas en `PAUSED`.

## Datos actuales

### Planilla comercial

- 149 prospectos cargados.
- 88 con campo WhatsApp.
- 148 con web.
- 94 con email.
- 149 con reseñas, análisis y ambos borradores.

Estos valores reflejan cobertura de campos, no aprobación de calidad. El primer lote demostró que los datos existentes deben tratarse como provisionales.

### Historial de email

- 59 prospectos gestionados.
- 50 emails enviados previamente.
- 49 sin rebote registrado.
- 1 rebote blando.
- 0 rebotes duros registrados.
- 1 destinatario duplicado omitido.
- 0 respuestas positivas y 0 reuniones registradas.

El historial importado está separado de la nueva campaña para evitar atribuir esos envíos a la implementación actual.

## Estado de los canales

### Email

La implementación aislada existe y sus pruebas offline pasan. Continúa bloqueada porque el acceso read-only no permitió demostrar:

1. alias `Ortu - WIS <ortu@wis-agency.com>` autenticado en la cuenta de envío;
2. credencial WIS exclusiva en n8n;
3. firma HTML final aprobada;
4. SPF/DKIM alineados con el transporte elegido;
5. persistencia real del identificador del proveedor y reconciliación;
6. prueba interna aprobada.

### WhatsApp 5679

El canal está definido como Baileys/no oficial. No utiliza plantillas de Meta. Incluye binding a WIS/5679, idempotencia persistente, opt-in, bajas, límites, email-first y reconciliación de `OUTCOME_UNKNOWN`.

Permanece desactivado porque todavía falta conectar un adaptador/transporte y validar una sesión real de la línea 5679. Fuera de la ventana de 24 horas, el sistema bloquea con `SERVICE_WINDOW_EXPIRED`.

## Calidad del primer lote

Resultado de filas 2–26:

| Estado | Cantidad |
| --- | ---: |
| PASS | 0 |
| REVIEW | 8 |
| DISCARD | 17 |

Problemas transversales:

- 25/25 no usan `analizadas/total accesible`.
- No queda demostrable desde la celda que sólo se analizaron reseñas de 1–3 estrellas.
- 25/25 borradores responden al modelo anterior y necesitan adaptación.
- 17/25 son corporaciones, cadenas o grupos fuera del foco mediana/chica.

El detalle por fila está en `ops/research-audit/distribuidoras_300_rows_2_26_qa_2026-09-27.md`.

## Cómo usar el dashboard

Desde la raíz del repositorio:

```powershell
rtk npm run dashboard:start
```

Abrir `http://127.0.0.1:4174/#overview`.

Vistas principales:

- **Resumen:** situación ejecutiva, historial y canales.
- **Datos:** cobertura comercial y QA.
- **Actividad:** métricas del historial y órdenes recientes.
- **Pipeline:** estado paralelo de los cuatro carriles.
- **Canales:** salud de email y WhatsApp.
- **Controles:** botones y programaciones.
- **Activación:** checklist de salida.

Los botones escriben una orden local append-only. Las programaciones pueden configurarse diaria o cada X minutos, pero comienzan pausadas. Para convertirlas en ejecuciones reales falta un consumidor autenticado que sincronice `Task_Commands` y despache al orquestador. Ese consumidor no debe tener permisos de envío.

## Trabajo pendiente

### Antes de seleccionar el canario

1. Reemplazar las 17 filas descartadas.
2. Revalidar las 8 filas en revisión.
3. Recapturar reseñas 1–3 con formato `x/y`.
4. Rehacer copy sólo después de validar research.
5. Completar verificación autenticada de Gmail/Brevo y DNS.
6. Aprobar firma HTML y hacer una prueba interna.
7. Conectar transporte/sesión WhatsApp 5679 en modo canario.
8. Conectar el consumidor de comandos y la sincronización automática del dashboard.

### Reservado para mañana por decisión del usuario

9. Seleccionar exactamente 5 destinatarios de email elegibles.
10. Seleccionar hasta 2 WhatsApp con opt-in verificable.
11. Registrar la aprobación humana exacta del lote.
12. Ejecutar y medir el canario sólo si los canales y destinatarios siguen elegibles.

## Regla de activación

No activar una programación de envío desde el dashboard. Los horarios preparados sólo corresponden a research, QA y sincronización. Cualquier envío, activación de proveedor o canario debe continuar detrás de la aprobación humana registrada.
