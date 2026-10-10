param([string]$OutputDirectory, [switch]$OfficialRelease)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$releasePath = Join-Path $root 'release'
$releaseItem = Get-Item -LiteralPath $releasePath -Force -ErrorAction Stop
if ($releaseItem.LinkType -or (($releaseItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
  throw "Refusing linked release directory: $releasePath"
}
$releaseRoot = (Resolve-Path -LiteralPath $releasePath).Path
$baselineApk = Join-Path $releaseRoot 'codex_harmony_signed_final_20261009/codex_xiaodongge-v3.1.3-33-test.apk'
$baselineHash = '009201a437e47cd92da580c369911bf896fba7c0818f61d40fa875394db99fc1'
$officialSigner = '6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022'

if (-not (Test-Path -LiteralPath $baselineApk -PathType Leaf)) { throw "Verified baseline APK missing: $baselineApk" }
if ((Get-FileHash -LiteralPath $baselineApk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $baselineHash) { throw 'Verified v3.1.3 baseline APK hash changed' }
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $releaseRoot ('codex_signed_test_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
}
$outputPath = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
  [IO.Path]::GetFullPath($OutputDirectory)
} else { [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory)) }
if (-not $outputPath.StartsWith($releaseRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Build output must be a new directory under release: $outputPath"
}
if (Test-Path -LiteralPath $outputPath) { throw "Refusing to overwrite build evidence: $outputPath" }
function Assert-NoLinks([string]$base, [string]$relativePath) {
  $baseItem = Get-Item -LiteralPath $base -Force
  if ($baseItem.LinkType -or (($baseItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw "Refusing linked build path: $base"
  }
  $current = $base
  foreach ($part in ($relativePath -split '[\\/]')) {
    $current = Join-Path $current $part
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if ($item.LinkType -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
        throw "Refusing linked build path: $current"
      }
    }
  }
}
Assert-NoLinks $releaseRoot ($outputPath.Substring($releaseRoot.Length + 1))

$gradle = Get-Content -LiteralPath (Join-Path $root 'android/app/build.gradle') -Raw
$codeMatches = [regex]::Matches($gradle, '(?m)^\s*versionCode\s+(\d+)\s*$')
$nameMatches = [regex]::Matches($gradle, '(?m)^\s*versionName\s+"([^"]+)"\s*$')
$idMatches = [regex]::Matches($gradle, '(?m)^\s*applicationId\s+"([^"]+)"\s*$')
if ($codeMatches.Count -ne 1 -or $nameMatches.Count -ne 1 -or $idMatches.Count -ne 1) { throw 'Cannot uniquely read Android version and application ID from build.gradle' }
$versionCode = [int]$codeMatches[0].Groups[1].Value
$versionName = $nameMatches[0].Groups[1].Value
$applicationId = $idMatches[0].Groups[1].Value
$npmVersion = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$normalizedNpmVersion = if ($npmVersion -match '^(\d+\.\d+)\.0$') { $Matches[1] } else { $npmVersion }
if ($versionName -ne $npmVersion -and $versionName -ne $normalizedNpmVersion) { throw "Android versionName $versionName does not match npm version $npmVersion" }
$capacitor = Get-Content -LiteralPath (Join-Path $root 'capacitor.config.ts') -Raw
$capMatches = [regex]::Matches($capacitor, '(?m)^\s*appId:\s*"([^"]+)"\s*,?\s*$')
if ($capMatches.Count -ne 1 -or $capMatches[0].Groups[1].Value -ne $applicationId) { throw 'Capacitor appId differs from Android applicationId' }

foreach ($name in @('XIAODONGGE_KEYSTORE_FILE', 'XIAODONGGE_KEYSTORE_PASSWORD', 'XIAODONGGE_KEY_ALIAS', 'XIAODONGGE_KEY_PASSWORD')) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))) {
    [Environment]::SetEnvironmentVariable($name, [Environment]::GetEnvironmentVariable($name, 'User'), 'Process')
  }
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))) { throw "Release signing configuration is incomplete: $name" }
}
if (-not (Test-Path -LiteralPath $env:XIAODONGGE_KEYSTORE_FILE -PathType Leaf)) { throw 'Release keystore file is missing' }
$sdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Users\lenovo\AppData\Local\Android\Sdk' }
$jdk = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot' }
$apkSigner = Join-Path $sdk 'build-tools/36.0.0/apksigner.bat'
$aapt2 = Join-Path $sdk 'build-tools/36.0.0/aapt2.exe'
$initScript = Join-Path $root 'scripts/gradle-mirrors.init.gradle'
foreach ($required in @($sdk, $jdk, $apkSigner, $aapt2, $initScript)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Required build tool is missing: $required" }
}
$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$jdk\bin;$sdk\platform-tools;$sdk\build-tools\36.0.0;$env:Path"

function Get-SignerDigest([string]$apk) {
  $result = & $apkSigner verify --verbose --print-certs $apk
  if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed: $apk" }
  $match = [regex]::Match(($result -join "`n"), 'Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)')
  if (-not $match.Success) { throw "APK signer digest missing: $apk" }
  return $match.Groups[1].Value.ToLowerInvariant()
}

function Get-ApkMetadata([string]$apk) {
  $result = & $aapt2 dump badging $apk
  if ($LASTEXITCODE -ne 0) { throw "APK metadata inspection failed: $apk" }
  $packageLine = $result | Where-Object { $_ -like 'package:*' } | Select-Object -First 1
  $match = [regex]::Match($packageLine, "^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'")
  if (-not $match.Success) { throw "APK package metadata missing: $apk" }
  return @{ id = $match.Groups[1].Value; code = [int]$match.Groups[2].Value; name = $match.Groups[3].Value }
}

$baselineSigner = Get-SignerDigest $baselineApk
if ($baselineSigner -ne $officialSigner) { throw 'Published APK signer differs from the approved certificate' }
$baselineMetadata = Get-ApkMetadata $baselineApk
if ($applicationId -ne $baselineMetadata.id -or $versionCode -le $baselineMetadata.code) {
  throw 'Android package ID differs or versionCode does not upgrade the published APK'
}

function Remove-GeneratedDirectory([string]$relativePath) {
  $target = [IO.Path]::GetFullPath((Join-Path $root $relativePath))
  if (-not $target.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean outside project: $target"
  }
  Assert-NoLinks $root $relativePath
  if (-not (Test-Path -LiteralPath $target)) { return }
  if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw "Expected generated directory: $target" }
  Remove-Item -LiteralPath $target -Recurse -Force
}

New-Item -ItemType Directory -Path $outputPath -ErrorAction Stop | Out-Null
Start-Transcript -LiteralPath (Join-Path $outputPath 'build.log') | Out-Null
Push-Location $root
try {
  & pwsh -NoProfile -File 'scripts/codex_verify_project.ps1' -Scope full -Output (Join-Path $outputPath 'checks') 2>&1 | Tee-Object -FilePath (Join-Path $outputPath 'gate.log')
  if ($LASTEXITCODE -ne 0) { throw 'Full project gate failed; release build stopped' }
  & (Join-Path $PSScriptRoot 'codex_check_android_unit.ps1') -Output (Join-Path $outputPath 'android-unit') 2>&1 | Tee-Object -FilePath (Join-Path $outputPath 'android-unit-gate.log')
  if ($LASTEXITCODE -ne 0) { throw 'Android JUnit gate failed; release build stopped' }

  Write-Output 'CHECK clean-mobile-assets'
  Remove-GeneratedDirectory 'mobile/dist'
  Write-Output 'CHECK clean-android-assets'
  Remove-GeneratedDirectory 'android/app/src/main/assets/public'
  Write-Output 'CHECK build-fresh-web'
  & npm.cmd run mobile:build 2>&1 | Tee-Object -FilePath (Join-Path $outputPath 'mobile-build.log')
  if ($LASTEXITCODE -ne 0) { throw 'Fresh mobile build failed' }
  & npm.cmd run android:sync 2>&1 | Tee-Object -FilePath (Join-Path $outputPath 'capacitor-sync.log')
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
  Push-Location 'android'
  try {
    & .\gradlew.bat --init-script $initScript assembleRelease 2>&1 | Tee-Object -FilePath (Join-Path $outputPath 'gradle.log')
    if ($LASTEXITCODE -ne 0) { throw 'Gradle release build failed' }
  } finally { Pop-Location }

  $apk = Join-Path $root 'android/app/build/outputs/apk/release/app-release.apk'
  if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) { throw 'Signed APK is missing after Gradle build' }
  $metadata = Get-ApkMetadata $apk
  if ($metadata.id -ne $applicationId -or $metadata.code -ne $versionCode -or $metadata.name -ne $versionName) {
    throw 'Built APK package metadata differs from build.gradle'
  }
  $signer = Get-SignerDigest $apk
  if ($signer -ne $officialSigner) { throw 'Built APK signer differs from the approved certificate' }
  & node 'scripts/codex_verify_apk_assets.mjs' --apk $apk --web 'mobile/dist' --staged 'android/app/src/main/assets/public' --output (Join-Path $outputPath 'assets.json')
  if ($LASTEXITCODE -ne 0) { throw 'APK public asset verification failed' }

  $artifactName = if ($OfficialRelease) { "codex_xiaodongge-v$versionName-$versionCode.apk" } else { "codex_xiaodongge-v$versionName-$versionCode-test.apk" }
  $destination = Join-Path $outputPath $artifactName
  Copy-Item -LiteralPath $apk -Destination $destination -ErrorAction Stop
  $sourceHash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
  $copiedHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sourceHash -ne $copiedHash) { throw 'Copied APK hash differs from the verified source' }
  $manifest = [ordered]@{
    baselineApk = $baselineApk; baselineSha256 = $baselineHash; baselineVersionCode = $baselineMetadata.code
    sourceCommit = (& git rev-parse HEAD).Trim(); worktree = (& git status --short)
    packageId = $applicationId; versionCode = $versionCode; versionName = $versionName; npmVersion = $npmVersion
    signerSha256 = $signer; apk = $destination; apkBytes = (Get-Item -LiteralPath $destination).Length
    apkSha256 = $copiedHash; checks = (Join-Path $outputPath 'checks/codex_results.json')
    androidUnit = (Join-Path $outputPath 'android-unit'); assets = (Join-Path $outputPath 'assets.json')
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputPath 'build_manifest.json') -Encoding utf8
  Write-Output "Signed APK verified: $destination"
  Write-Output "SHA-256: $copiedHash"
} finally {
  Pop-Location
  Stop-Transcript | Out-Null
}
