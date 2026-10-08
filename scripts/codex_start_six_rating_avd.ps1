param([string]$Output = 'release/codex_six_rating_upgrade_20260930')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$destination = [IO.Path]::GetFullPath((Join-Path $root $Output))
if (-not $destination.StartsWith((Join-Path $root 'release') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'AVD evidence must stay under project release' }
if (Test-Path -LiteralPath $destination) { throw 'Use a new AVD evidence directory' }
$sdk = 'C:\Users\lenovo\AppData\Local\Android\Sdk'
$emulator = Join-Path $sdk 'emulator/emulator.exe'
$adb = Join-Path $sdk 'platform-tools/adb.exe'
$template = 'C:\Users\lenovo\.android\avd\Pixel_8a.avd\config.ini'
$image = Join-Path $sdk 'system-images/android-36/google_apis_playstore/x86_64/system.img'
foreach ($file in @($emulator, $adb, $template, $image)) { if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required local input missing: $file" } }
$devices = & $adb devices -l
if ($LASTEXITCODE -ne 0) { throw 'ADB device inspection failed' }
if ($devices -match '^emulator-5562\s') { throw 'Selected emulator port is occupied' }
$avdName = 'codex_six_rating_api36'
$avdHome = Join-Path $destination 'avd'
$avdPath = Join-Path $avdHome ($avdName + '.avd')
New-Item -ItemType Directory -Path $avdPath | Out-Null
$config = Get-Content -LiteralPath $template
$config = $config -replace '^AvdId=.*$', "AvdId=$avdName" -replace '^avd.ini.displayname=.*$', "avd.ini.displayname=$avdName"
$config = $config -replace '^fastboot.forceColdBoot=.*$', 'fastboot.forceColdBoot=yes' -replace '^fastboot.forceFastBoot=.*$', 'fastboot.forceFastBoot=no'
$config | Set-Content -LiteralPath (Join-Path $avdPath 'config.ini') -Encoding utf8
@('avd.ini.encoding=UTF-8', "path=$avdPath", 'target=android-36') | Set-Content -LiteralPath (Join-Path $avdHome ($avdName + '.ini')) -Encoding utf8
$env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_AVD_HOME = $avdHome
$env:ANDROID_USER_HOME = Join-Path $destination 'android-user'
New-Item -ItemType Directory -Path $env:ANDROID_USER_HOME | Out-Null
$process = Start-Process -FilePath $emulator -ArgumentList @('-avd', $avdName, '-port', '5562', '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $destination 'codex_emulator_stdout.log') -RedirectStandardError (Join-Path $destination 'codex_emulator_stderr.log')
$process.Id | Set-Content -LiteralPath (Join-Path $destination 'codex_emulator_pid.txt') -Encoding ascii
$deadline = [DateTime]::UtcNow.AddMinutes(5)
do {
    Start-Sleep -Seconds 1
    if ($process.HasExited) { throw "Emulator exited with $($process.ExitCode); see logs" }
    $boot = & $adb -s emulator-5562 shell getprop sys.boot_completed 2>$null
    if ($boot -eq '1') { break }
} while ([DateTime]::UtcNow -lt $deadline)
if ($boot -ne '1') { throw 'Isolated emulator did not finish booting in five minutes' }
$name = & $adb -s emulator-5562 emu avd name
if ($LASTEXITCODE -ne 0 -or $name[0] -ne $avdName) { throw 'Unexpected AVD identity' }
Write-Output "Ready: $avdName / emulator-5562; evidence: $destination"
