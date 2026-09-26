# Incidente: publicación sin cita y republicación idempotente

Fecha: 2026-08-26

## Qué ocurrió

La publicación aprobada incluía porcentajes verificables, pero omitía la fuente y el contexto metodológico dentro del post. Al eliminarla y volver a usar el mismo `post_id`, el servicio de publicación devolvió el enlace anterior por idempotencia sin crear una actividad nueva.

## Causas

1. El Writer prohibía enlaces y confiaba en que el texto general fuera suficiente.
2. La cita dependía de que el modelo la redactara correctamente.
3. El publicador usa `post_id` como clave de idempotencia; reutilizar un registro eliminado produce un falso éxito con la URL anterior.
4. El reemplazo manual no reactivaba `AUTO_PUBLISH` para una única aprobación.

## Correcciones

- La publicación anterior fue eliminada en LinkedIn y el registro 22 quedó marcado como `eliminado`.
- La versión corregida se publicó con un `post_id` nuevo (29) y una URL nueva.
- La cita ahora se construye de forma determinística a partir de metadatos verificados y se agrega después de la redacción.
- El validador exige una línea `Fuente:`, una única URL original, contexto, longitud válida y una sola pregunta.
- El flujo de reemplazo vuelve a habilitar la publicación única antes de enviar el borrador a Telegram.
- Toda republicación posterior a una eliminación debe clonar el contenido a un nuevo registro para obtener una nueva clave de idempotencia.
- El normalizador ya no informa `publisher_failed` cuando la publicación fue exitosa.

## Resultado verificado

- URL eliminada: `https://www.linkedin.com/feed/update/urn:li:activity:7498478171609120768/`
- URL vigente: `https://www.linkedin.com/feed/update/urn:li:activity:7498480401167032320/`
- Fuente visible: Orgvue / Watermelon Research, encuesta a 300 responsables de RR.HH. de EE.UU., con enlace al artículo original.
