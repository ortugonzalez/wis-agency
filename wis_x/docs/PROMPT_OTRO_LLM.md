# Prompt para continuar el proyecto con otro LLM

Copiar y pegar el siguiente texto en el LLM que esté ejecutando el proyecto:

```text
Estás trabajando en un proyecto Node.js llamado WIS X Bot con un módulo Beta Tester para auditar workflows.

Ruta del proyecto:
C:\Users\Operador\Documents\ChatGPT\WIS BOTS\wis_x

Reglas obligatorias:

1. Trabajá exclusivamente desde PowerShell en Windows. No uses Docker, docker-compose, bash, WSL ni comandos Linux.
2. Antes de modificar archivos, inspeccioná el proyecto y leé package.json, README.md, docs/BETA_TESTER.md, docs/PROMPT_OTRO_LLM.md y los archivos relevantes de src/beta-tester.
3. Usá el launcher oficial `.\run-beta-tester.ps1` para las pruebas.
4. No hagas llamadas reales a n8n, Telegram, X, LinkedIn, Supabase ni APIs externas salvo que el usuario haya indicado explícitamente un entorno staging, una URL y una allowlist.
5. Nunca publiques, envíes mensajes, actives workflows, edites workflows, borres datos ni ejecutes scripts desconocidos automáticamente.
6. Mantené `BETA_ALLOW_SIDE_EFFECTS=false`.
7. Conservá la separación entre pruebas locales y pruebas de integración.
8. No guardes tokens, cookies, passwords, API keys ni secretos en archivos, reportes o logs.
9. Usá `apply_patch` para editar archivos.
10. Si existe RTK, anteponé `rtk` a los comandos de terminal.

Arquitectura actual:

- `src/beta-tester/core.mjs`: reportes, sanitización, guardas y contexto.
- `src/beta-tester/rules.mjs`: reglas generales, n8n, HTTPS, encoding y escenarios.
- `src/beta-tester/adapters.mjs`: adaptadores n8n, HTTP, scripts Node y browser.
- `src/beta-tester/exploratory.mjs`: escenarios exploratorios y proveedor IA opcional.
- `src/beta-tester/runner.mjs`: orquestación de auditorías.
- `src/beta-tester/cli.mjs`: CLI.
- `run-beta-tester.ps1`: launcher oficial de PowerShell.
- `config/beta-tester.wis-x.json`: configuración del export n8n actual.
- `test/beta-tester.test.mjs`: pruebas del auditor.

Comandos seguros:

    .\run-beta-tester.ps1 -Mode Test
    .\run-beta-tester.ps1 -Mode Audit

Para staging se requiere autorización explícita:

    .\run-beta-tester.ps1 -Mode Staging -AllowNetwork -BaseUrl 'https://staging.example.com' -AllowedHosts 'staging.example.com'

Para browser:

    .\run-beta-tester.ps1 -Mode Browser -AllowNetwork -BaseUrl 'https://staging.example.com' -AllowedHosts 'staging.example.com'

El objetivo funcional es auditar workflows completos y encontrar errores, fricciones, problemas de HTTPS, encoding UTF-8, emojis, caracteres acentuados, duplicados, timeouts, reintentos, credenciales expuestas, ramas desconectadas y estados de éxito falsos.

Cuando implementes algo:

1. Explicá primero qué encontraste.
2. Aplicá el cambio mínimo necesario.
3. Agregá o actualizá tests locales.
4. Ejecutá `.\run-beta-tester.ps1 -Mode Test`.
5. Si corresponde, ejecutá `.\run-beta-tester.ps1 -Mode Audit`.
6. Informá archivos modificados, comandos ejecutados, resultado y cualquier bloqueo.

No inventes que una prueba staging fue realizada si no se proporcionaron URL y allowlist. Si un objetivo no tiene adaptador, hacé análisis estático y marcá la ejecución como bloqueada de forma segura.
```
