$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sdk = if ($env:ANDROID_SDK_ROOT) {
  $env:ANDROID_SDK_ROOT
} elseif ($env:ANDROID_HOME) {
  $env:ANDROID_HOME
} else {
  "C:\Users\lenovo\AppData\Local\Android\Sdk"
}
$jdk = if ($env:JAVA_HOME) {
  $env:JAVA_HOME
} else {
  "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
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
  $initScript = Join-Path $root "scripts\gradle-mirrors.init.gradle"
  if (-not (Test-Path -LiteralPath $initScript)) {
    throw "Gradle init script not found: $initScript"
  }
  Push-Location "android"
  try {
    .\gradlew.bat --init-script $initScript assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle release build failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
  $apk = Join-Path $root "android\app\build\outputs\apk\release\app-release-unsigned.apk"
  if (-not (Test-Path -LiteralPath $apk)) {
    $alt = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
    if (-not (Test-Path -LiteralPath $alt)) {
      throw "Release APK not found: $apk"
    }
    $apk = $alt
  }
  Write-Host "Release APK built: $apk"
} finally {
  Pop-Location
}
