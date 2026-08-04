param(
  [string]$SourceApk,
  [string]$BaselineApk,
  [string]$DestinationApk
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Users\lenovo\AppData\Local\Android\Sdk' }
$apkSigner = Join-Path $sdk 'build-tools\36.0.0\apksigner.bat'
$aapt2 = Join-Path $sdk 'build-tools\36.0.0\aapt2.exe'

if ([string]::IsNullOrWhiteSpace($SourceApk)) { $SourceApk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk' }
if ([string]::IsNullOrWhiteSpace($BaselineApk)) { $BaselineApk = Join-Path $root 'release\xiaodongge-v2.1.9.apk' }
if ([string]::IsNullOrWhiteSpace($DestinationApk)) { $DestinationApk = Join-Path $root 'release\xiaodongge-v2.1.9-native-export-2fd6711.apk' }

foreach ($requiredFile in @($SourceApk, $BaselineApk, $apkSigner, $aapt2)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw "Required file not found: $requiredFile" }
}
if (Test-Path -LiteralPath $DestinationApk) { throw "Refusing to overwrite existing release artifact: $DestinationApk" }

function Get-SignerDigest([string]$apkPath) {
  $nativeArgs = @('verify', '--verbose', '--print-certs', $apkPath)
  $verification = & $apkSigner @nativeArgs 2>&1
  $verifyExit = $LASTEXITCODE
  if ($verifyExit -ne 0) { throw "APK signature verification failed with exit code $verifyExit`: $apkPath" }
  $match = [regex]::Match(($verification -join [Environment]::NewLine), 'Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)')
  if (-not $match.Success) { throw "APK signer digest not found: $apkPath" }
  return $match.Groups[1].Value.ToLowerInvariant()
}

$sourceSigner = Get-SignerDigest $SourceApk
$baselineSigner = Get-SignerDigest $BaselineApk
if ($sourceSigner -ne $baselineSigner) { throw "Release signer does not match the installed-version baseline" }

$badgingArgs = @('dump', 'badging', $SourceApk)
$badging = & $aapt2 @badgingArgs
$badgingExit = $LASTEXITCODE
if ($badgingExit -ne 0) { throw "APK metadata inspection failed with exit code $badgingExit" }
$packageLine = $badging | Where-Object { $_ -like 'package:*' } | Select-Object -First 1
if ($packageLine -notmatch "name='com\.yves\.musicarchive'") { throw "Unexpected package metadata: $packageLine" }
if ($packageLine -notmatch "versionCode='12'") { throw "Unexpected versionCode metadata: $packageLine" }
if ($packageLine -notmatch "versionName='2\.1\.9'") { throw "Unexpected versionName metadata: $packageLine" }

$copyParams = @{ LiteralPath = $SourceApk; Destination = $DestinationApk; ErrorAction = 'Stop' }
Copy-Item @copyParams
$published = Get-Item -LiteralPath $DestinationApk
$hash = (Get-FileHash -LiteralPath $DestinationApk -Algorithm SHA256).Hash.ToLowerInvariant()

Write-Output "APK=$($published.FullName)"
Write-Output "BYTES=$($published.Length)"
Write-Output "SHA256=$hash"
Write-Output "SIGNER_SHA256=$sourceSigner"
Write-Output "PACKAGE=com.yves.musicarchive"
Write-Output "VERSION_CODE=12"
Write-Output "VERSION_NAME=2.1.9"
