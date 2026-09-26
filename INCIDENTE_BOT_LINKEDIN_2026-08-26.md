# Incidente del bot LinkedIn — 2026-08-26

## Impacto

La ejecución programada de las 07:30 ART no llegó a generar borrador. El Conductor terminó técnicamente con estado `success`, pero la respuesta de negocio del Scout fue `{"ok":false,"error":"invalid secret"}` y se envió la alerta por Telegram.

## Causa raíz

La secuencia era:

`Set run_id fecha` → `Log Inicio` → `Call Scout`

`Set run_id fecha` construía correctamente `BOT_SECRET`, `run_id` y `fecha`. Sin embargo, `Log Inicio` devolvía la fila creada en `run_logs`, reemplazando el item corriente. `Call Scout` intentaba leer los tres valores desde `$json`, por lo que enviaba un header y un body incompletos.

El Scout rechazaba correctamente la llamada por autenticación. No era una credencial vencida ni una caída de Telegram, OpenAI, Supabase o n8n.

## Corrección aplicada

En el workflow activo `bot_conductor` (`AUXgK79OHhhUu2iR`), `Call Scout` ahora referencia explícitamente el contexto estable de `Set run_id fecha`:

- Header: `$('Set run_id fecha').first().json.BOT_SECRET`
- Body `run_id`: `$('Set run_id fecha').first().json.run_id`
- Body `fecha`: `$('Set run_id fecha').first().json.fecha`

El workflow permaneció activo.

## Verificación

- Verificación estructural remota: PASS.
- Llamada autenticada real al Scout: HTTP 200.
- Autenticación: PASS, sin `invalid secret`.
- Ejecución n8n: `193776`, estado `success`.
- Resultado de negocio: noticia `205` seleccionada con score `8`.
- Publicación en LinkedIn: no se realizó.

## Prevención de regresión

- `fix_conductor_scout_context.mjs`: reparación idempotente con precondiciones y postcondiciones.
- `verify_conductor_scout_context.mjs`: auditoría read-only del origen de los campos y estado activo.
- `test_scout_authenticated_boundary.mjs`: prueba viva de la frontera Conductor/Scout sin publicar.
- `audit_n8n_bots_runtime.mjs`: resumen sanitario de workflows y ejecuciones relevantes sin mostrar secretos.

