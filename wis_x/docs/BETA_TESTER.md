# Beta Tester de workflows

El auditor funciona con dos capas: reglas determinísticas y escenarios exploratorios. Por defecto sólo analiza archivos locales y no hace llamadas de red.

## Ejecución oficial desde PowerShell

El proyecto no usa Docker. El launcher oficial es `run-beta-tester.ps1` y debe ejecutarse desde PowerShell ubicado en la carpeta del proyecto.

```powershell
Set-Location 'C:\Users\Operador\Documents\ChatGPT\WIS BOTS\wis_x'
Set-ExecutionPolicy -Scope Process Bypass
.\run-beta-tester.ps1 -Mode Test
.\run-beta-tester.ps1 -Mode Audit
```

## Comandos directos alternativos

```powershell
rtk npm test
rtk npm run audit
rtk npm run audit:staging
rtk npm run audit:browser
```

`npm test` está limitado a `test/**/*.test.mjs`. Los scripts live de n8n no se descubren ni se ejecutan como tests unitarios.

Para staging, el launcher exige `-AllowNetwork`, una URL y una allowlist. Los efectos secundarios permanecen desactivados.

## Auditoría local

```powershell
rtk npm run audit
```

La configuración inicial está en `config/beta-tester.wis-x.json`. El resultado se guarda en `reports/beta-tester/` como `report.json` y `report.html`. Esa carpeta está ignorada por Git porque contiene evidencias generadas.

## Auditoría staging

Configurar la URL y la allowlist antes de activar red:

```powershell
$env:BETA_TARGET_BASE_URL='https://staging.example.com'
$env:BETA_ALLOWED_HOSTS='staging.example.com'
$env:BETA_ALLOW_NETWORK='true'
$env:BETA_ALLOW_SIDE_EFFECTS='false'
rtk npm run audit:staging
```

Fuera de `local`, las URLs externas deben usar HTTPS. El auditor no activa, edita, elimina ni importa workflows n8n. Las pruebas mutantes siguen bloqueadas mientras `BETA_ALLOW_SIDE_EFFECTS` sea falso.

## Auditoría de un workflow n8n por API

Usar una configuración con `source.workflowId` y `source.apiBaseUrl`, además de:

```powershell
$env:N8N_API_BASE_URL='https://n8n.example.com'
$env:N8N_API_KEY='...'
$env:BETA_ALLOWED_HOSTS='n8n.example.com'
$env:BETA_ALLOW_NETWORK='true'
```

La API se consulta con GET para obtener el workflow y, opcionalmente, sus últimas ejecuciones. No se ejecuta ninguna operación de escritura.

## Playwright

La capacidad de navegador es opcional. Si no está instalado, el informe queda bloqueado con una recomendación clara:

```powershell
rtk npm install --save-dev playwright
rtk npx playwright install chromium
rtk npm run audit:browser
```

## IA exploratoria

El núcleo funciona sin proveedor de IA y genera casos determinísticos de Unicode, duplicados, entradas faltantes, timeouts y valores inesperados. La integración de IA usa un proveedor inyectable y acepta únicamente escenarios con título, categoría, entrada y resultado esperado. La IA no puede ejecutar acciones ni aprobar un workflow por sí sola.
