# automation-integrations

Mantené n8n, conectores, esquemas, seguridad, el backend de `wis-agency` y observabilidad compartidos. La lógica específica de LinkedIn y X pertenece a sus operadores.

## Checklist

- Empezá por auditoría read-only.
- Exportá workflows sin secretos ni credenciales embebidas.
- Documentá rollback antes de una mutación.
- Pedí handoff explícito antes de editar archivos de canal.
- Evitá migraciones destructivas y reactivaciones automáticas.
- Tratá webhooks, schedules, flags y credenciales como acciones externas.

Activar workflows, cambiar schedules o aplicar producción requiere aprobación humana.
