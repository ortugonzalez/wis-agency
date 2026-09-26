[CmdletBinding()]
param(
  [ValidateSet('Test', 'Audit', 'Staging', 'Browser', 'Install')]
  [string]$Mode = 'Audit',
  [string]$Config = '',
  [string]$Out = '',
  [string]$BaseUrl = '',
  [string]$AllowedHosts = '',
  [switch]$AllowNetwork
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$defaultConfig = Join-Path $projectRoot 'config/beta-tester.wis-x.json'
$browserConfig = Join-Path $projectRoot 'config/beta-tester.browser.json'

Push-Location $projectRoot
try {
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js no está instalado o no está en PATH.' }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm no está disponible en PATH.' }
  if (-not (Test-Path (Join-Path $projectRoot 'package.json'))) { throw "No se encontró package.json en $projectRoot" }

  $env:BETA_ALLOW_SIDE_EFFECTS = 'false'
  if ($BaseUrl) { $env:BETA_TARGET_BASE_URL = $BaseUrl }
  if ($AllowedHosts) { $env:BETA_ALLOWED_HOSTS = $AllowedHosts }

  switch ($Mode) {
    'Install' {
      & npm.cmd install
      exit $LASTEXITCODE
    }
    'Test' {
      & npm.cmd test
      exit $LASTEXITCODE
    }
    'Audit' {
      if (-not $Config) { $Config = $defaultConfig }
      if (-not $Out) { $Out = Join-Path $projectRoot 'reports/beta-tester' }
      & node.exe src/beta-tester/cli.mjs audit --config $Config --out $Out
      exit $LASTEXITCODE
    }
    'Staging' {
      if (-not $AllowNetwork) { throw 'Para staging se requiere -AllowNetwork explícito.' }
      if (-not $Config) { $Config = $defaultConfig }
      if (-not $Out) { $Out = Join-Path $projectRoot 'reports/beta-tester-staging' }
      if (-not $env:BETA_TARGET_BASE_URL) {
        $target = Get-Content -Raw -Encoding utf8 $Config | ConvertFrom-Json
        if (-not $target.source.baseUrl) { throw 'Falta -BaseUrl o source.baseUrl en la configuración.' }
      }
      if (-not $env:BETA_ALLOWED_HOSTS) { throw 'Falta -AllowedHosts o BETA_ALLOWED_HOSTS.' }
      $env:BETA_ALLOW_NETWORK = 'true'
      & node.exe src/beta-tester/cli.mjs audit --config $Config --staging --out $Out
      exit $LASTEXITCODE
    }
    'Browser' {
      if (-not $AllowNetwork) { throw 'Para browser/staging se requiere -AllowNetwork explícito.' }
      if (-not $Config) { $Config = $browserConfig }
      if (-not $Out) { $Out = Join-Path $projectRoot 'reports/beta-tester-browser' }
      if (-not $env:BETA_TARGET_BASE_URL) {
        $target = Get-Content -Raw -Encoding utf8 $Config | ConvertFrom-Json
        if (-not $target.source.baseUrl) { throw 'Falta -BaseUrl o source.baseUrl en la configuración browser.' }
      }
      if (-not $env:BETA_ALLOWED_HOSTS) { throw 'Falta -AllowedHosts o BETA_ALLOWED_HOSTS.' }
      $env:BETA_ALLOW_NETWORK = 'true'
      & node.exe src/beta-tester/cli.mjs browser --config $Config --staging --out $Out
      exit $LASTEXITCODE
    }
  }
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  Pop-Location
}
