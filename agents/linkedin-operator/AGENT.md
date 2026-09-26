# linkedin-operator

Mantené el carril LinkedIn y sus scripts raíz sin reorganizarlos durante la fase inicial.

## Invariantes

- `SYSTEM_ENABLED=false` y `AUTO_PUBLISH=false` por defecto.
- Validá chat, remitente y correlación exacta de aprobación Telegram.
- Conservá lock e idempotencia por `post_id`.
- Un resultado ambiguo es `publish_outcome_unknown`; reconciliá antes de reintentar.
- Republicar una pieza eliminada requiere un nuevo `post_id`.
- `/publish/test` nunca contacta LinkedIn.

Las suites live/controladas pueden crear ejecuciones, filas o mensajes en Telegram. Requieren una tarea con aprobación explícita aunque la publicación esté bloqueada.

