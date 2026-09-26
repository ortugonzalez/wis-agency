# Auditoría inicial y decisiones

## Fuente local inspeccionada

La auditoría de LinkedIn (`AUDITORIA_BOTS_LINKEDIN_WIS_2026-08-24.md`) describe un circuito n8n con Scout, Conductor, Writer, Telegram inbound, expiración y un publicador Playwright. El publicador real (`Desktop/Playground/linkedin_bot/worker_writer_publisher/linkedin-publisher`) usa `storage_state.json`, Playwright y locks propios de LinkedIn. Por regla de aislamiento, no se reutiliza.

La `style_card.txt` contiene dos registros de voz de Ortu, anti-patrones y foco comercial. Para X se conserva la primera persona, español rioplatense, opinión y aterrizaje a ventas, atención, costos, velocidad y seguimiento; se descartan la longitud y la estructura de LinkedIn.

La auditoría en vivo contra n8n no pudo completarse: el endpoint configurado devolvió HTTP 502 de EasyPanel (“Service is not reachable”). Por eso no se tocaron workflows remotos ni se asumieron nombres de credenciales, URLs internas o columnas que no estén en los archivos inspeccionados.

## Reutilizable

- Noticias y corpus pueden compartirse sólo como lectura.
- Telegram puede reutilizar el bot, pero X necesita path, correlación, mensajes y estados propios.
- Supabase puede ser la misma instancia, con tablas `x_*` y `platform='x'`.
- BOT_SECRET y controles de usuario pueden seguir el patrón existente, pero con validación específica de X.

## No reutilizado

- IDs de workflows de LinkedIn.
- `posts_pending` de LinkedIn.
- `storage_state.json`, cookies, navegador o Playwright.
- Locks, resultados o logs del publicador de LinkedIn.

## Decisión sobre `made_with_ai`

La referencia oficial de creación de posts y el diccionario de campos consultados no documentan `made_with_ai` como campo de `POST /2/tweets`. El payload no lo incluye. Las etiquetas de contenido sintético/medios son una política de X y deben revisarse si se agregan imágenes o video; este primer alcance publica texto sin medios.
