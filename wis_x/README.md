# WIS X Bot

Implementación aislada del carril de X para WIS. No importa ni modifica workflows, tablas, credenciales, sesión ni publicador de LinkedIn.

## Estado actual

- Núcleo de conteo ponderado basado en `twitter-text`, NFC y validación repetida.
- OAuth 2.0 Authorization Code + PKCE, scopes `tweet.read tweet.write users.read offline.access`, refresh sin login diario.
- Cliente oficial REST v2 para `POST /2/tweets`, `GET /2/users/me` y reconciliación por ID.
- Publicación única e hilos secuenciales con `reply.in_reply_to_tweet_id`.
- Claim atómico, intentos por parte, huella, estado `outcome_unknown` y bloqueo de reintento ciego.
- Migración Supabase separada y tests dry-run/unitarios.
- Export n8n inactivo y sin secretos.

## Verificación local

```powershell
Set-Location 'C:\Users\Operador\Documents\ChatGPT\WIS BOTS\wis_x'
Set-ExecutionPolicy -Scope Process Bypass
.\run-beta-tester.ps1 -Mode Install
.\run-beta-tester.ps1 -Mode Test
.\run-beta-tester.ps1 -Mode Audit
```

El proyecto se opera desde PowerShell y no requiere Docker. La guía del Beta Tester está en `docs/BETA_TESTER.md` y el prompt para otro LLM en `docs/PROMPT_OTRO_LLM.md`.

El servidor requiere `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BOT_SECRET` y tokens X inyectados por un secret manager. Por defecto no publica: `X_SYSTEM_ENABLED=false`, `X_AUTO_PUBLISH_ONE_SHOT=false` y `X_DRY_RUN=true`.

## Componentes

- `src/text.mjs`: contador y contrato Telegram.
- `src/oauth.mjs`: PKCE, intercambio y refresh.
- `src/x-api.mjs`: cliente REST, headers de rate limit y errores seguros.
- `src/publisher.mjs`: orquestación idempotente de single/thread.
- `src/store.mjs`: adapter Supabase.
- `src/server.mjs`: API interna protegida por `x-bot-secret`.
- `sql/001_x_schema.sql`: tablas, índices y funciones atómicas.
- `workflows/wis-x-export.json`: seed de workflows n8n separados.
