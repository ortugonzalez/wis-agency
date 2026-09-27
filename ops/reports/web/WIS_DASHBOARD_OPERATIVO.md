# WIS — Informe de uso del sistema multiagente y dashboard operativo

Fecha del informe: 27 de septiembre de 2026  
Estado general: Fundación completada; etapa de ingresos lista para comenzar; dashboard validado localmente y a la espera de aprobación para un despliegue privado.

## 1. Qué se construyó

WIS cuenta ahora con una base operativa para coordinar trabajo entre agentes sin perder trazabilidad ni mezclar responsabilidades. El sistema tiene cuatro piezas principales:

1. **Nueve roles permanentes** con misión, permisos, rutas de escritura, herramientas, prohibiciones y pruebas.
2. **Contratos versionados** para describir tareas, ejecuciones, transferencias y aprobaciones.
3. **Un tablero operativo en Google Sheets** que registra la cola, las ejecuciones, las aprobaciones y los incidentes.
4. **Un dashboard general** que reúne el estado ejecutivo, el camino crítico, los responsables, las evidencias y las conversaciones fuente.

El repositorio conserva la definición y las reglas. El Sheet conserva el estado operativo. El dashboard funciona como vista ejecutiva de lectura y decisión.

## 2. Qué muestra el dashboard

### Resumen

La primera vista responde rápidamente:

- cuál es la prioridad actual;
- cuántas tareas están completadas, listas o pendientes;
- si existen aprobaciones humanas esperando decisión;
- cuál es el camino crítico hasta completar distribuidoras y logísticas;
- cuál fue la última ejecución y qué pruebas superó;
- cuánta capacidad de agentes está configurada.

### Trabajo operativo

Permite buscar y filtrar tareas. Cada fila muestra prioridad, responsable, estado, dependencia y siguiente acción. Al abrir una tarea aparece su alcance completo, entregable y necesidad de aprobación.

También muestra las ejecuciones y los handoffs, para saber qué se hizo, con qué evidencia y qué debe ocurrir después.

### Agentes

Presenta los nueve roles:

- `wis-orchestrator`;
- `growth-research`;
- `commercial-activation`;
- `content-strategy`;
- `linkedin-operator`;
- `x-operator`;
- `web-brand`;
- `automation-integrations`;
- `qa-ops`.

Esta vista permite decidir rápidamente a quién corresponde cada pedido y evita que dos agentes modifiquen el mismo activo.

### Fuentes

Reúne las doce conversaciones históricas asignadas al sistema. Son fuentes de contexto, no ejecutores automáticos. Se pueden buscar por nombre o agente responsable. El frontend no incluye IDs de conversaciones ni la URL/ID del Sheet privado.

## 3. Qué podés hacer ahora

### Prioridad 1 — Auditar la base existente de distribuidoras

La tarea `WIS-REV-001` ya está en estado `READY`.

Uso recomendado:

1. `growth-research` toma un lote de 25 filas.
2. Elimina o marca para reemplazo corporaciones grandes, duplicados y empresas fuera del perfil.
3. Verifica contactos corporativos sin adivinarlos.
4. Analiza sólo reseñas de 1, 2 y 3 estrellas.
5. Registra siempre `analizadas/total accesible`.
6. Entrega el lote a `qa-ops`.
7. QA valida unicidad, tamaño objetivo, contactos y cobertura de reseñas.

No se agregan columnas nuevas a la planilla comercial. La evidencia y el control viven en el tablero operativo.

### Prioridad 2 — Completar 300 distribuidoras argentinas

Después de la auditoría, `WIS-REV-002` procesa lotes de 25 hasta llegar a 300 empresas únicas medianas o chicas.

El circuito recomendado por lote es:

`research → QA de datos → borradores comerciales → QA final`

Los mensajes de WhatsApp y email se preparan, pero no se envían. Si en el futuro se quiere activar un envío, el sistema debe crear una aprobación con evidencia y quedar en `WAITING_APPROVAL`.

### Prioridad 3 — Completar 300 logísticas de Latinoamérica

`WIS-LOG-001` comienza sólo cuando las distribuidoras hayan superado QA. Mantiene el mismo criterio de lotes, contactos verificables, reseñas negativas y borradores sin envío.

### Prioridad 4 — Convertir evidencia comercial en contenido

Cuando existan patrones validados en prospectos y reseñas:

- `content-strategy` puede transformar problemas repetidos en briefs y casos;
- `linkedin-operator` y `x-operator` pueden adaptar esos briefs a cada canal;
- todo queda como borrador hasta aprobación;
- no deben inventarse clientes, resultados ni testimonios.

### Prioridad 5 — Llevar casos aprobados a la web

`web-brand` puede convertir casos y piezas aprobadas en páginas o secciones de WIS Agency. Primero se revisa responsive, enlaces y formularios. El despliegue requiere una aprobación humana separada.

## 4. Cómo usar el sistema en el día a día

### Inicio del día

1. Abrir el dashboard y revisar la prioridad actual.
2. Confirmar que no haya tareas `BLOCKED` o aprobaciones pendientes.
3. Abrir el Sheet fuente si se necesita modificar el estado real.
4. Asignar como máximo tres especialistas simultáneos y sin superposición de activos.

### Durante una ejecución

1. Crear o actualizar la fila de la tarea.
2. Registrar la ejecución con agente, branch/worktree, evidencia y pruebas.
3. Guardar avances por lote confirmado.
4. Si cambia el responsable, crear un handoff con artefacto, pruebas y siguiente acción.
5. Si aparece una acción externa, detener el flujo en `WAITING_APPROVAL`.

### Cierre del día

1. Revisar resultados y bloqueos.
2. Confirmar que no existan duplicados ni estados inflados.
3. Registrar la siguiente acción concreta.
4. Mantener el dashboard como vista ejecutiva y el Sheet como fuente operativa.

## 5. Acciones permitidas sin aprobación adicional

- investigar fuentes públicas;
- leer Google Maps y webs oficiales;
- preparar análisis y borradores;
- ejecutar pruebas locales sin efectos externos;
- editar las planillas autorizadas dentro de las columnas existentes;
- registrar tareas, runs, handoffs e incidentes en el tablero operativo;
- crear ramas y worktrees para tareas de código.

## 6. Acciones que deben detenerse para aprobación

- enviar WhatsApp, email o Telegram;
- publicar o borrar en LinkedIn o X;
- activar o reprogramar n8n, webhooks o automatizaciones;
- desplegar el dashboard, la web o un servicio;
- aplicar migraciones productivas o cambios destructivos;
- modificar credenciales, permisos, facturación o cuentas externas;
- ejecutar pruebas que creen mensajes, registros o publicaciones reales.

## 7. Límites actuales

El dashboard generado es un **snapshot de lectura al 27/09/2026**. No modifica el Sheet ni consulta datos privados desde el navegador. El bundle desplegable omite la URL y el identificador del Sheet, además de los IDs internos de las conversaciones. Esta decisión evita exponer credenciales o referencias privadas.

El manifiesto estático no implementa autenticación propia. Por eso el despliegue sólo puede hacerse mediante un Site configurado y verificado como `owner-only`; si la plataforma no confirma ese nivel de acceso, no debe publicarse.

La fuente de verdad continúa siendo el Sheet `WIS · Operaciones de Agentes`. Cuando el volumen operativo aumente, el siguiente paso técnico será automatizar una exportación segura del Sheet al archivo de datos del dashboard o incorporar una API autenticada. Esa ampliación debe diseñarse como una tarea independiente.

Tampoco se ejecutaron pruebas LinkedIn con efectos reales. Los flags productivos permanecen apagados. X conserva dry-run e idempotencia.

## 8. Próxima secuencia recomendada

1. Aprobar o no la publicación privada del dashboard.
2. Ejecutar `WIS-REV-001` sobre el primer lote de 25 distribuidoras.
3. Validar el lote con `qa-ops`.
4. Ajustar los criterios si QA detecta falsos positivos.
5. Repetir hasta sanear la base provisional.
6. Continuar con `WIS-REV-002` hasta 300 distribuidoras.
7. Iniciar `WIS-LOG-001` para 300 logísticas LATAM.

## 9. Indicadores que conviene incorporar cuando haya datos reales

- empresas validadas por lote;
- empresas descartadas y motivo;
- contactos corporativos verificables;
- cobertura `reseñas analizadas/total accesible`;
- problemas negativos recurrentes por rubro;
- borradores comerciales aprobados;
- respuestas recibidas, sólo cuando exista autorización de envío;
- reuniones generadas y propuestas emitidas;
- tiempo promedio desde research hasta QA final.

No conviene agregar estos indicadores antes de contar con datos consistentes. El tablero actual prioriza trazabilidad y siguiente acción sobre métricas decorativas.

## 10. Archivos principales

- Dashboard: `ops/reports/web/wis-operations-dashboard/out/`
- Registro de agentes: `agents/registry.yaml`
- Reglas globales: `AGENTS.md`
- Operación y recuperación: `docs/AGENT_OPERATIONS.md`
- Inventario baseline: `docs/BASELINE_INVENTORY.md`
- Este informe: `ops/reports/web/WIS_DASHBOARD_OPERATIVO.md`

El dashboard queda listo para uso local. Su despliegue privado está registrado como aprobación pendiente y no se ejecuta automáticamente.
