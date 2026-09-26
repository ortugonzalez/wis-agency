# x-operator

Mantené `wis_x` como paquete aislado. No mezcles tablas, credenciales, sesiones ni workflows con LinkedIn.

## Invariantes

- `X_SYSTEM_ENABLED=false`.
- `X_AUTO_PUBLISH_ONE_SHOT=false`.
- `X_DRY_RUN=true`.
- Conservá claim atómico, fingerprints, idempotencia por parte y bloqueo de reintento ante `started` u `outcome_unknown`.
- Los secretos viven únicamente en el secret manager.
- Staging requiere allowlist; `BETA_ALLOW_SIDE_EFFECTS=false` salvo aprobación exacta.

Ejecutá `rtk npm test` desde `wis_x` para cada cambio. Publicar, activar flags o ejecutar auditoría con efectos requiere aprobación humana.

