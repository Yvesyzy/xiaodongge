[CmdletBinding()]
param([int]$Port = 5580, [switch]$RetryFailedInitialization)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
. (Join-Path $PSScriptRoot 'codex_android_env.ps1')
$toolchain = Get-CodexAndroidToolchain
Set-CodexAndroidEnvironment $toolchain
$avdName = 'codex_artwork_quality_20261012'
$avdHome = Join-Path $projectRoot 'release/codex_android_quality_20261012/avd-home'
$avdPath = Join-Path $avdHome ($avdName + '.avd')
$emulator = Join-Path $toolchain.SdkRoot 'emulator/emulator.exe'
$systemImage = Join-Path $toolchain.SdkRoot 'system-images/android-36/google_apis_playstore/x86_64'
$template = 'C:\Users\lenovo\.android\avd\Pixel_8a.avd\config.ini'
foreach ($required in @($emulator, $template, (Join-Path $systemImage 'system.img'))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw ('Missing verified emulator input: ' + $required) }
}
Assert-CodexPathWithin -BasePath $projectRoot -CandidatePath $avdPath -RequireChild
if ($Port % 2 -ne 0 -or $Port -lt 5554 -or $Port -gt 5682) { throw 'Choose an even supported emulator console port' }
$occupied = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @($Port, $Port + 1) })
if ($occupied.Count) { throw 'Emulator test port is occupied; existing process was not touched' }
if (Test-Path -LiteralPath $avdPath) {
    if (-not $RetryFailedInitialization) { throw 'Test AVD already exists; refuse to overwrite or reuse user data' }
    $previous = Get-Content -LiteralPath (Join-Path $avdHome 'codex_avd_process.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($previous.avdPath -ne $avdPath -or $previous.avd -ne $avdName -or
        (Get-Process -Id $previous.processId -ErrorAction SilentlyContinue)) { throw 'Previous launch is not a stopped task-owned attempt' }
    if (@(Get-ChildItem -LiteralPath $avdPath -Force | Where-Object Name -NE 'config.ini').Count) { throw 'AVD contains runtime data; do not overwrite initialization' }
    foreach ($file in @('codex_avd_process.json','codex_emulator_stdout.log','codex_emulator_stderr.log')) {
        Copy-Item -LiteralPath (Join-Path $avdHome $file) -Destination (Join-Path $avdHome ('codex_failed_pointer_' + $file))
    }
} else { [void](New-Item -ItemType Directory -Path $avdPath) }
$config = Get-Content -LiteralPath $template -Raw -Encoding UTF8
$config = $config.Replace('AvdId=Pixel_8a', 'AvdId=' + $avdName)
$config = $config.Replace('avd.ini.displayname=Pixel 8a', 'avd.ini.displayname=Codex artwork quality isolated test')
$config = $config.Replace('showDeviceFrame=yes', 'showDeviceFrame=no')
$config = $config.Replace('fastboot.forceColdBoot=no', 'fastboot.forceColdBoot=yes')
$config = $config.Replace('fastboot.forceFastBoot=yes', 'fastboot.forceFastBoot=no')
$config = $config.Replace('image.sysdir.1=system-images\android-36\google_apis_playstore\x86_64\', 'image.sysdir.1=' + $systemImage + '\')
[IO.File]::WriteAllText((Join-Path $avdPath 'config.ini'), $config, [Text.UTF8Encoding]::new($false))
$pointer = @('avd.ini.encoding=UTF-8', ('path=' + $avdPath), 'target=android-36') -join [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $avdHome ($avdName + '.ini')), $pointer, [Text.UTF8Encoding]::new($false))
$env:ANDROID_AVD_HOME = $avdHome
$env:ANDROID_EMULATOR_HOME = Join-Path $avdHome 'runtime'
[void](New-Item -ItemType Directory -Path $env:ANDROID_EMULATOR_HOME -Force)
$nativeArguments = @('-avd', $avdName, '-port', [string]$Port, '-no-window', '-no-snapshot', '-no-audio', '-no-boot-anim', '-gpu', 'swiftshader_indirect')
$outputLog = Join-Path $avdHome 'codex_emulator_stdout.log'
$errorLog = Join-Path $avdHome 'codex_emulator_stderr.log'
$process = Start-Process -FilePath $emulator -ArgumentList $nativeArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog
$record = [ordered]@{ avd=$avdName; avdHome=$avdHome; avdPath=$avdPath; port=$Port; serial=('emulator-' + $Port);
    processId=$process.Id; emulator=$emulator; startedAt=[DateTimeOffset]::Now.ToString('o'); stdout=$outputLog; stderr=$errorLog;
    scope='Fresh project-owned emulator data; personal Pixel_8a config read only as hardware template, no personal disk copied' }
$record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $avdHome 'codex_avd_process.json') -Encoding UTF8
$record | ConvertTo-Json -Compress
