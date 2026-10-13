$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'codex_android_env.ps1')
$toolchain = Get-CodexAndroidToolchain
Set-CodexAndroidEnvironment $toolchain

Push-Location $root
try {
  Remove-CodexGeneratedDirectory -Root $root -RelativePath "mobile\dist"
  Remove-CodexGeneratedDirectory -Root $root -RelativePath "android\app\src\main\assets\public"
  npm.cmd run mobile:build
  if ($LASTEXITCODE -ne 0) { throw "Mobile build failed with exit code $LASTEXITCODE" }
  npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath "android\gradlew.bat")) {
    throw "android\gradlew.bat not found. Run npx.cmd cap add android first."
  }
  $initScript = Join-Path $root "scripts\gradle-mirrors.init.gradle"
  if (-not (Test-Path -LiteralPath $initScript)) {
    throw "Gradle init script not found: $initScript"
  }
  Push-Location "android"
  try {
    .\gradlew.bat --init-script $initScript assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
  $apk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
  if (-not (Test-Path -LiteralPath $apk)) {
    throw "APK not found after build: $apk"
  }
  Write-Host "APK built: $apk"
} finally {
  Pop-Location
}
