$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$requiredSigningVariables = @(
  "XIAODONGGE_KEYSTORE_FILE",
  "XIAODONGGE_KEYSTORE_PASSWORD",
  "XIAODONGGE_KEY_ALIAS",
  "XIAODONGGE_KEY_PASSWORD"
)
foreach ($name in $requiredSigningVariables) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    [Environment]::SetEnvironmentVariable($name, [Environment]::GetEnvironmentVariable($name, 'User'), 'Process')
  }
}
$missingSigningVariables = $requiredSigningVariables | Where-Object {
  [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
}
if ($missingSigningVariables.Count -gt 0) {
  throw "Release signing configuration is incomplete. Missing: $($missingSigningVariables -join ', ')"
}
$keystore = [Environment]::GetEnvironmentVariable("XIAODONGGE_KEYSTORE_FILE")
if (-not (Test-Path -LiteralPath $keystore -PathType Leaf)) {
  throw "Release keystore file not found: $keystore"
}
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
$buildTools = Join-Path $sdk "build-tools\36.0.0"
$apkSigner = Join-Path $buildTools "apksigner.bat"
$aapt2 = Join-Path $buildTools "aapt2.exe"
if (-not (Test-Path -LiteralPath $apkSigner -PathType Leaf)) { throw "apksigner not found: $apkSigner" }
if (-not (Test-Path -LiteralPath $aapt2 -PathType Leaf)) { throw "aapt2 not found: $aapt2" }

Push-Location $root
try {
  & npm.cmd run mobile:build
  if ($LASTEXITCODE -ne 0) { throw "Mobile build failed with exit code $LASTEXITCODE" }
  & npm.cmd run android:sync
  if ($LASTEXITCODE -ne 0) { throw "Capacitor Android sync failed with exit code $LASTEXITCODE" }
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
  $apk = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
  if (-not (Test-Path -LiteralPath $apk)) {
    throw "Signed release APK not found: $apk"
  }
  $signature = & $apkSigner verify --verbose --print-certs $apk
  if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed with exit code $LASTEXITCODE" }
  $signature | Write-Output
  if (($signature -join "`n") -notmatch 'Signer #1 certificate SHA-256 digest: 6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022') {
    throw "APK signer does not match the v2.5 production certificate"
  }
  $badging = & $aapt2 dump badging $apk
  if ($LASTEXITCODE -ne 0) { throw "APK metadata inspection failed with exit code $LASTEXITCODE" }
  $packageLine = $badging | Where-Object { $_ -like "package:*" } | Select-Object -First 1
  if ($packageLine -notmatch "name='com\.yves\.musicarchive'") { throw "Unexpected APK package metadata: $packageLine" }
  if ($packageLine -notmatch "versionCode='15'") { throw "Unexpected APK versionCode metadata: $packageLine" }
  if ($packageLine -notmatch "versionName='2\.5'") { throw "Unexpected APK versionName metadata: $packageLine" }
  $releaseDirectory = Join-Path $root "release"
  New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
  $publishedApk = Join-Path $releaseDirectory "xiaodongge-v2.5.apk"
  Copy-Item -LiteralPath $apk -Destination $publishedApk -Force
  $hash = (Get-FileHash -LiteralPath $publishedApk -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host "Signed release APK verified: $publishedApk"
  Write-Host "SHA-256: $hash"
} finally {
  Pop-Location
}
