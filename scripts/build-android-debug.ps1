$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sdk = "C:\Users\lenovo\AppData\Local\Android\Sdk"
$jdk = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"

function Remove-BuildDirectory($relativePath) {
  $target = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $target)) {
    return
  }
  $rootFull = [System.IO.Path]::GetFullPath($root)
  $targetFull = [System.IO.Path]::GetFullPath($target)
  if (-not $targetFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove path outside project: $targetFull"
  }
  Remove-Item -LiteralPath $targetFull -Recurse -Force
}

if (-not (Test-Path -LiteralPath $sdk)) {
  throw "Android SDK not found: $sdk"
}
if (-not (Test-Path -LiteralPath $jdk)) {
  throw "JDK 21 not found: $jdk"
}

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$jdk\bin;$sdk\platform-tools;$sdk\build-tools\36.0.0;$env:Path"

Push-Location $root
try {
  Remove-BuildDirectory "mobile\dist"
  Remove-BuildDirectory "android\app\src\main\assets\public"
  npm.cmd run mobile:build
  npx.cmd cap sync android
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
