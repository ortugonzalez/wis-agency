# Operación de agentes WIS

## Propósito

Este sistema separa responsabilidades sin reemplazar los bots existentes. Codex crea subagentes temporales a partir de contratos versionados; el orquestador combina resultados, controla dependencias y evita efectos externos no aprobados.

## Fuentes de verdad

- Repositorio: roles, permisos, contratos, pruebas y runbooks.
- `WIS · Operaciones de Agentes`: backlog, ejecuciones, aprobaciones e incidentes.
- Planillas comerciales existentes: prospectos y borradores. No se agregan columnas por iniciativa de un agente.
- Sistemas de canal: Supabase, n8n, LinkedIn, X y web conservan sus propios estados.

## Flujo de una tarea

1. El orquestador crea un `Task` con objetivo, propietario, entradas, entregables, alcance de escritura y pruebas.
2. La tarea pasa de `BACKLOG` a `READY` cuando sus dependencias están completas.
3. Para código, el orquestador crea `codex/<rol>-<task_id>` en un worktree aislado.
4. El especialista ejecuta sólo dentro de su alcance y entrega un `Handoff` con evidencia y pruebas.
5. `qa-ops` revisa de forma independiente y registra hallazgos.
6. Si existe una acción externa, la tarea queda en `WAITING_APPROVAL`. Sin aprobación no se envía, publica, despliega ni activa nada.
7. El orquestador integra y marca `DONE` sólo cuando todas las pruebas y aprobaciones requeridas están registradas.

## Paralelismo

Máximo: un orquestador y tres especialistas activos. El trabajo se paraleliza únicamente cuando no comparte rutas, filas, rangos, workflows o recursos externos. En el pipeline comercial se usan lotes de 25:

1. `growth-research` prepara el lote.
2. `qa-ops` valida identidad, tamaño, contactos y cobertura de reseñas.
3. `commercial-activation` prepara mensajes sobre filas validadas.
4. `qa-ops` revisa la personalización final.

El siguiente lote de research puede avanzar mientras comercial trabaja sobre el lote anterior, siempre que escriban rangos diferentes.

## Prioridad de ejecución

1. Auditar la base existente de distribuidoras como datos provisionales.
2. Completar 300 distribuidoras argentinas medianas o chicas.
3. Completar 300 logísticas de Latinoamérica.
4. Consolidar mensajes, follow-ups y propuestas sin enviarlos.
5. Continuar con contenido, LinkedIn, X, web e infraestructura compartida.

## Recuperación

- Cada lote se confirma antes de comenzar el siguiente.
- Una reanudación parte del último `Run` exitoso y verifica idempotencia antes de escribir.
- Un timeout de publicación se registra como `outcome_unknown`; nunca se reintenta a ciegas.
- Un conflicto de ruta, fila o workflow pasa a `BLOCKED` y vuelve al orquestador.
- Un secreto expuesto exige detener la tarea, rotar el secreto fuera del repositorio y revisar logs.

## Límites por sistema

- LinkedIn: scripts actuales permanecen en la raíz. Las pruebas live/controladas requieren aprobación previa.
- X: `wis_x` se mantiene autocontenido; conservar gates, claim atómico e idempotencia.
- Web: `wis-agency` es un repositorio independiente y usa su propio branch/worktree.
- Repositorios externos (`chattermate.chat`, `design-lab`, `pgvector-0.8.6`) son referencias y no forman parte del baseline raíz.

## Comandos de verificación

```powershell
rtk npm test
Set-Location wis_x
rtk npm test
```

Las auditorías de staging, tests LinkedIn live, activaciones y despliegues sólo se ejecutan mediante una tarea aprobada que describa sus efectos.

