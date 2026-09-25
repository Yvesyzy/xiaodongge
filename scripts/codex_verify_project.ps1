param(
    [ValidateSet('affected', 'full')][string]$Scope = 'affected',
    [string]$Checks,
    [string]$Output
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeArguments = @((Join-Path $PSScriptRoot 'codex_verify_project.mjs'), '--scope', $Scope)
if ($Checks) { $nodeArguments += @('--checks', $Checks) }
if ($Output) { $nodeArguments += @('--output', $Output) }
Push-Location $root
try {
    & node @nodeArguments
    $resultCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $resultCode
