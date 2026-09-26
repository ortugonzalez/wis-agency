# WIS X n8n export

`wis-x-export.json` contiene siete workflows hermanos, inactivos por seguridad y sin credenciales embebidas. Se puede importar como colección en n8n. Todos usan `America/Argentina/Buenos_Aires` y leen secretos desde variables de entorno o credenciales de n8n.

Variables esperadas por los nodos HTTP:

- `X_PUBLISHER_URL`: URL interna del servicio `wis_x/src/server.mjs`.
- `N8N_PUBLIC_BASE_URL`: URL pública de n8n.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BOT_SECRET`, `TELEGRAM_BOT_TOKEN`.
- `OPENAI_API_KEY` y `OPENAI_MODEL` si el Writer se conecta a un modelo desde n8n.

El export es un seed seguro: la instalación debe revisar las URLs internas, mapear las credenciales Supabase/Telegram existentes y activar únicamente después del checklist del runbook. No contiene tokens ni reutiliza IDs de LinkedIn.
