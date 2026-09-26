# Runbook operativo WIS X

## 1. Configuración manual única

1. En el Developer Console de X, crear una App y habilitar OAuth 2.0 con PKCE.
2. Configurar una Redirect URI HTTPS que apunte al callback OAuth del servicio autorizado.
3. Solicitar exactamente `tweet.read`, `tweet.write`, `users.read` y `offline.access`.
4. Guardar Client ID, Client Secret, access token y refresh token en n8n Credentials o un secret manager. No escribirlos en Supabase, repositorio, JSON exportado, logs o Telegram.
5. Cargar el usuario sin `@` en `X_USERNAME` y verificar que coincida con `GET /2/users/me`.
6. Ejecutar el SQL de `sql/001_x_schema.sql` en Supabase.
7. Crear las variables del `.env.example` en el entorno del publicador. Mantener `X_SYSTEM_ENABLED=false`, `X_AUTO_PUBLISH_ONE_SHOT=false`, `X_DRY_RUN=true`.
8. Importar `workflows/wis-x-export.json`, mapear credenciales y revisar las URLs internas. Los workflows quedan inactivos.

## 2. OAuth PKCE

El servicio debe generar `state`, `code_verifier` y `code_challenge` en memoria. Abrir la URL producida por `buildAuthorizeUrl`, aprobar la aplicación y entregar el `code` al callback. El callback debe comparar `state`, canjear el código en `https://api.x.com/2/oauth2/token` y guardar sólo los tokens en el secret manager.

El refresh usa `grant_type=refresh_token`. Si X devuelve un refresh token nuevo, reemplazar el secreto anterior de forma atómica. Nunca devolver tokens en la respuesta HTTP.

## 3. Dry-run

1. Ejecutar `rtk npm test`.
2. Con flags de desarrollo, llamar al publisher con `dry_run=false`: el gate de configuración lo convierte en dry-run mientras `X_SYSTEM_ENABLED` o `X_AUTO_PUBLISH_ONE_SHOT` sean falsos.
3. Verificar que el borrador se guarda en `x_posts_pending`, Telegram muestra cada conteo y el publisher no llama a X.
4. Repetir OK: debe responder que no existe aprobación vigente o que ya fue consumida.

## 4. Activación gradual

Cuando el usuario haya visto y aprobado explícitamente una publicación real de prueba:

1. Confirmar `GET /auth/health` devuelve la cuenta correcta.
2. Confirmar idempotencia e índices activos.
3. Confirmar `X_DRY_RUN=true` para la prueba de integración n8n.
4. Cambiar `X_DRY_RUN=false` sólo para la prueba aprobada.
5. Activar `X_SYSTEM_ENABLED=true` y `X_AUTO_PUBLISH_ONE_SHOT=true` únicamente después del resultado correcto.

## 5. Incidentes

- `401`: refresh una vez; si falla, bloquear y pedir reautorización.
- `403`: no reintentar; revisar permisos, plan o restricción.
- `429`: registrar los headers `x-rate-limit-limit`, `x-rate-limit-remaining`, `x-rate-limit-reset`; no reintentar una escritura automáticamente.
- timeout o 5xx después de enviar: `outcome_unknown`; reconciliar por ID si se guardó. No repetir la solicitud.
- hilo parcial: conservar IDs ya guardados, informar URLs y reconciliar antes de continuar desde la primera parte faltante.
- token/log accidental: rotar de inmediato el secreto y revisar logs; el código redacciona bearer/token/secret/authorization.

## 6. Rollback

Poner `X_SYSTEM_ENABLED=false` y `X_AUTO_PUBLISH_ONE_SHOT=false`, desactivar sólo los siete workflows `WIS X - ...` y conservar las filas para auditoría. No tocar workflows, tablas, credenciales ni el contenedor de LinkedIn. Para rollback de esquema, no borrar datos: deshabilitar el carril X y aplicar una migración reversible revisada por DBA.
