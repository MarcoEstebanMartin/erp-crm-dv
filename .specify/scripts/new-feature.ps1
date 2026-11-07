<#
.SYNOPSIS
    Inicializa un nuevo espacio de trabajo para una funcionalidad siguiendo GitHub Spec Kit.
.EXAMPLE
    .\.specify\scripts\new-feature.ps1 -Id "001" -Name "control-vencimientos-lotes"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Id,

    [Parameter(Mandatory=$true)]
    [string]$Name
)

$ErrorActionPreference = "Stop"
$FeatureSlug = "$Id-$Name"
$FeatureDir = Join-Path "specs\features" $FeatureSlug

if (Test-Path $FeatureDir) {
    Write-Host "[!] El directorio $FeatureDir ya existe." -ForegroundColor Yellow
} else {
    New-Item -ItemType Directory -Force -Path $FeatureDir | Out-Null
    Copy-Item ".specify\templates\spec-template.md" (Join-Path $FeatureDir "spec.md")
    Copy-Item ".specify\templates\plan-template.md" (Join-Path $FeatureDir "plan.md")
    Copy-Item ".specify\templates\tasks-template.md" (Join-Path $FeatureDir "tasks.md")
    Write-Host "[OK] Feature workspace creado en: $FeatureDir" -ForegroundColor Green
}

# Actualizar .specify/feature.json
$FeatureJsonPath = ".specify\feature.json"
if (Test-Path $FeatureJsonPath) {
    $Config = Get-Content $FeatureJsonPath -Raw | ConvertFrom-Json
    $Config.active_feature = $FeatureSlug
    $Config | ConvertTo-Json -Depth 5 | Set-Content $FeatureJsonPath -Encoding UTF8
    Write-Host "[OK] Feature activa actualizada en .specify/feature.json -> $FeatureSlug" -ForegroundColor Cyan
}
