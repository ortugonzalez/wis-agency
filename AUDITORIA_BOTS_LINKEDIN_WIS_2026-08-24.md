# Auditoría general — Bots LinkedIn WIS

Fecha: 24 de agosto de 2026  
Estado final: **circuito técnico verificado; publicación real bloqueada hasta revalidar la sesión de LinkedIn**

## Veredicto ejecutivo

No conviene crear un tercer bot. Ya existen dos módulos útiles y complementarios:

1. **Contenido LinkedIn**: busca noticias de IA, elige una, redacta un post y lo manda a Telegram para aprobación.
2. **Prospección LinkedIn**: prepara mensajes personalizados, aplica reglas de calidad, registra todo en Google Sheets y clasifica respuestas/opt-out.

La mejor solución es mantenerlos separados por función, pero compartir seguridad, configuración, auditoría y criterios de aprobación. Esa unificación ya quedó iniciada con un secreto común y flags centrales en Supabase.

## Qué encontré

### 1. Bot de contenido creado con Claude

Componentes activos en n8n:

- Scout: consulta fuentes públicas, elimina duplicados, puntúa noticias y selecciona una.
- Conductor: ejecuta el circuito programado y respeta el interruptor general.
- Writer: redacta el post con un corpus de voz, lo registra y lo envía a Telegram.
- Telegram inbound: procesa `OK`, `editar:` y `no`.
- Expiración: cierra borradores que no fueron aprobados.
- Publisher: servicio Playwright que puede operar una sesión de LinkedIn.

En este momento:

- `SYSTEM_ENABLED=false`.
- `AUTO_PUBLISH=false`.
- Un `OK` en Telegram aprueba en modo de prueba, pero no publica.
- El Publisher está desplegado y sano, aunque permanece fuera del circuito mientras `AUTO_PUBLISH` siga apagado.

### 2. Bot de prospección creado con Codex

Componentes:

- Workflow de borradores: valida contacto, empresa, cargo vigente, scores, investigación, evidencia pública, cooldown y duplicados; genera cuatro mensajes en `BORRADOR_QA`.
- Workflow inbound: clasifica interés, pregunta, derivación, no-ahora, no-interés y opt-out; actualiza el contacto y bloquea futuros mensajes cuando corresponde.
- Google Sheet `WIS · LinkedIn · Operaciones y QA`: fuente de datos, evidencia y trazabilidad.

Este bot **no envía mensajes ni invitaciones**: sólo prepara y controla el trabajo para revisión y envío manual.

### 3. Trabajo histórico encontrado en otro chat de Claude

En el historial local apareció un circuito manual de prospección de marzo:

- Claude buscó aproximadamente 100 perfiles de decisores en Latinoamérica.
- Preparó un Excel con prospectos.
- Envió 20 invitaciones de conexión sin nota usando una sesión de navegador autenticada.
- Después filtró contactos de primer grado y preparó propuestas/presentaciones.

Eso demuestra que el agente de navegador puede investigar y ejecutar acciones puntuales, pero no es la arquitectura más repetible ni la más segura para producción.

## Errores encontrados y corregidos

### Críticos

- **Aprobación sin respetar `AUTO_PUBLISH`**: antes, un `OK` podía llamar al Publisher aunque la publicación automática figurara apagada. Ahora existe un gate obligatorio y, con el flag en `false`, Telegram confirma que no se publicó.
- **Telegram sin validar emisor**: cualquier usuario con acceso al bot podía intentar aprobar el último post pendiente. Ahora se validan chat y remitente autorizados, y se correlaciona la respuesta con el mensaje del borrador.
- **Webhooks de prospección sin autenticación**: podían modificar la planilla desde Internet sin secreto. Ambos webhooks ahora exigen el secreto compartido y devuelven HTTP 401 real.

### Altos

- **Scout daba falsos éxitos**: si faltaba `fecha`, Supabase rechazaba todas las candidatas, pero n8n continuaba y devolvía una ejecución `success` con `noticia_id` indefinido. Ahora la fecha se completa automáticamente, los errores de persistencia detienen el workflow y la respuesta usa el resultado validado.
- **Logs de Scout mal mapeados**: después de separar `logs`, el insert buscaba propiedades dentro de un objeto que ya no existía. El mapeo se corrigió a los campos reales.
- **Writer no guardaba `telegram_msg_id` ni marcaba la noticia procesada**: ambos estados ahora se actualizan antes de responder éxito.
- **Parseo inseguro de respuestas del modelo**: se reemplazaron los `JSON.parse` sin control por parseo validado, con HTTP 502 o aviso seguro cuando el modelo devuelve un formato inválido.
- **Riesgo de doble publicación**: Playwright reintentaba incluso después de presionar Publicar si no podía extraer el permalink. Ahora sólo reintenta fallos anteriores al envío; después del clic devuelve `publish_outcome_unknown` y no vuelve a publicar.
- **Falta de idempotencia del Publisher**: ahora hay lock por `post_id` y un resultado persistente para impedir reenvíos del mismo post.
- **Archivos sensibles sin exclusión Git**: el estado de sesión, QR y capturas de error quedaron protegidos por `.gitignore`.

### Documentación

Los resúmenes del Escritorio eran útiles como mapa, pero contenían afirmaciones desactualizadas —por ejemplo, decían que `telegram_msg_id` ya estaba resuelto—. Para esta auditoría se tomó como fuente de verdad el estado vivo de n8n, Supabase, Google Sheets y Docker.

## Comparación

| Enfoque | Lo hace mejor | Debilidad principal | Uso recomendado |
|---|---|---|---|
| Claude/n8n contenido | Descubrir temas, redactar posts y solicitar aprobación | El Publisher por navegador implica riesgo operativo y de cuenta | Contenido con revisión humana y publicación manual o integración autorizada |
| Codex/n8n prospección | QA, evidencia, deduplicación, cooldown, respuestas y opt-out | No ejecuta el último clic | Preparar campañas y controlar cumplimiento; envío manual |
| Claude con navegador | Investigación y acciones puntuales en una sesión real | Frágil, difícil de auditar y expuesto a límites/restricciones | Investigación asistida y tareas excepcionales, no campañas automáticas |

**Cuál es mejor:** ninguno gana para todo. El bot de Claude es mejor como fábrica de contenido; el de Codex es mejor como sistema de prospección segura; el agente de navegador sirve como operador puntual. La combinación de los dos primeros, con revisión humana, es la solución más sólida.

## Arquitectura unificada recomendada

```text
                 Configuración y seguridad compartidas
              Supabase: flags, secreto, logs y estados
                              |
              +---------------+---------------+
              |                               |
     Carril de contenido              Carril de prospección
 Scout -> Writer -> Telegram       Sheets -> QA -> Borradores
              |                               |
     aprobación humana              envío manual en LinkedIn
              |
 publicación manual o API autorizada
```

No se recomienda activar envíos o publicaciones mediante automatización del navegador: el Acuerdo de Usuario de LinkedIn prohíbe bots no autorizados para enviar mensajes o crear/compartir posts, y LinkedIn advierte que las invitaciones excesivas o herramientas prohibidas pueden restringir la cuenta. Fuentes oficiales: [User Agreement](https://www.linkedin.com/legal/user-agreement), [Prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions%3Flang%3Den), [Invitation restrictions](https://www.linkedin.com/help/linkedin/answer/a551012/types-of-restrictions-for-sending-invitations).

## Cinco pruebas de punta a punta

Todas se ejecutaron el 24/08/2026 en modo controlado, con `AUTO_PUBLISH=false`.

| # | Prueba | Resultado |
|---|---|---|
| 1 | Secreto inválido contra Scout, Writer, borradores e inbound | PASS: los cuatro devolvieron HTTP 401 |
| 2 | Scout completo | PASS: seleccionó y registró la noticia 173 |
| 3 | Writer completo | PASS: creó el borrador 3, lo envió a Telegram y guardó trazabilidad sin publicar |
| 4 | Borradores + duplicado | PASS: creó 4 borradores `NO_ENVIAR` y bloqueó la repetición como `DUPLICADO_BATCH` |
| 5 | Opt-out + intento posterior | PASS: clasificó `OPTOUT` y bloqueó el nuevo borrador como `CONTACTO_NO_ACTIVO` |

Verificación cruzada:

- Publisher: servicio Docker convergido y `/health` respondió `{"ok":true}` desde n8n.
- Sesión: el volumen conserva `storage_state.json` sin exponer su contenido.
- Google Sheets: quedaron cuatro filas nuevas en `BORRADOR_QA`/`NO_ENVIAR_HASTA_APROBACION` y el contacto sintético terminó en `OPTOUT`.
- LinkedIn: no se publicó ningún post ni se envió ningún mensaje o invitación durante estas pruebas.

## Cómo operar desde ahora

1. Dejar `SYSTEM_ENABLED=false` y `AUTO_PUBLISH=false` durante la etapa piloto.
2. Ejecutar Scout/Writer para recibir un borrador en Telegram.
3. Revisar el texto; aprobar sólo como registro de QA, sabiendo que no se publicará automáticamente.
4. Revisar los borradores de prospección en Sheets y enviarlos manualmente desde LinkedIn.
5. Si se quiere automatizar el último paso, usar una integración autorizada por LinkedIn y confirmar permisos antes de habilitar cualquier flag de producción.

## Reauditoría de publicación y Telegram — 24/08/2026 16:20 ART

### Causa del mensaje “PRUEBA DE LINKEDIN PAUSADA”

El preparador funcionó como estaba diseñado: consultó `/session`, recibió `session_expired`, avisó por Telegram y no creó ninguna fila `draft_enviado`. Por eso el `OK` posterior sí llegó al workflow de Telegram, pero `Get Latest Pending Post` devolvió una lista vacía y no había nada que aprobar ni publicar.

La pantalla de LinkedIn tampoco abre una pestaña adicional: está dentro del escritorio remoto mostrado por la pestaña noVNC. La inspección visual confirmó que actualmente muestra el formulario de acceso vacío.

### Fallas adicionales encontradas y corregidas

- La suite histórica `run_linkedin_5_tests.mjs` no cubría el circuito actual de publicación y todavía referenciaba un workflow inbound antiguo. Se agregaron pruebas específicas para el workflow vigente `nEzq5nGzYQ663wXM`.
- El servicio desplegado sobrescribía la imagen con `HEADFUL=0`, aunque el login visual usa navegador con pantalla. Se corrigió el servicio a `HEADFUL=1` bajo Xvfb para mantener la misma modalidad entre login, renovación y publicación.
- Se agregó `POST /publish/test`, accesible sólo dentro de la red privada y con cabecera de prueba, que valida el contrato del Publisher sin abrir navegador ni contactar LinkedIn.

### Pruebas controladas ejecutadas

| Prueba | Evidencia | Resultado |
|---|---|---|
| Integración completa segura | ejecución n8n `187197`; fila temporal 5; Telegram 4188 y 4189 | PASS: cola → Telegram → aprobación simulada → Publisher de prueba → confirmación → limpieza |
| Aprobación en workflow vigente | ejecución n8n `187204`; fila temporal 6; Telegram 4190 | PASS: correlación de respuesta → `Route` → `Patch estado=aprobado` → `IF Auto Publish` → confirmación dry-run |
| Servicios | n8n, `linkedin-publisher` y `vnc-bootstrap` en `1/1` | PASS |
| Cola final | `removable_count=0` | PASS: no quedaron borradores, regeneraciones ni aprobaciones de prueba |
| Seguridad final | `AUTO_PUBLISH=false`; Publisher de prueba informó `linkedin_contacted=false` | PASS: ninguna prueba podía publicar realmente |
| Sesión real | `/session` devuelve `session_expired` | BLOQUEO EXTERNO: requiere un único login humano en la pantalla noVNC |

El sistema ya demostró el flujo completo sin publicación real. El siguiente paso es iniciar sesión una vez en la pantalla noVNC, validar `/session=true` y recién entonces volver a encolar el post definitivo para que el usuario responda `OK`.

## Primera publicación real — resultado final

La sesión fue revalidada y persistida correctamente (`valid=true`, `session_refreshed=true`). El usuario aprobó el post 7 mediante Telegram y el mensaje fue recuperado después de corregir una divergencia entre la URL histórica del webhook de Telegram y el nombre registrado por n8n.

Durante la publicación real aparecieron dos incompatibilidades adicionales de la interfaz de LinkedIn:

- El disparador “Crear publicación” no era un `button` convencional; se cambió la búsqueda a texto visible y se añadió una prueba de compositor que abre el editor sin escribir ni publicar.
- La escritura carácter por carácter agotaba el timeout para textos largos; se cambió a `fill` sobre el editor `contenteditable`.
- La verificación asumía erróneamente que la primera tarjeta del feed era el post propio; ahora busca el texto aprobado en la actividad del perfil y extrae su permalink real.

El clic de publicación fue aceptado por LinkedIn y el post se verificó en modo lectura. La fila 7 quedó reconciliada como `publicado`, Telegram envió la confirmación 4196 y el Publisher guardó un resultado idempotente para impedir cualquier repetición del mismo `post_id`.

URL publicada: https://www.linkedin.com/feed/update/urn:li:activity:7497742645495189504/
