[CmdletBinding()]
param([string]$Output, [string]$SignedReleaseApk,
    [ValidateSet('com.yves.musicarchive.CodexPlaybackArtworkInstrumentedTest', 'com.yves.musicarchive.CodexArtworkPlatformProbeTest')]
    [string]$TestClass = 'com.yves.musicarchive.CodexPlaybackArtworkInstrumentedTest')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
. (Join-Path $PSScriptRoot 'codex_android_env.ps1')
$toolchain = Get-CodexAndroidToolchain -RequireBuildTools
Set-CodexAndroidEnvironment $toolchain
$avdRecord = Join-Path $projectRoot 'release/codex_android_quality_20261012/avd-home/codex_avd_process.json'
$avd = Get-Content -LiteralPath $avdRecord -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-CodexPathWithin -BasePath $projectRoot -CandidatePath $avd.avdPath -RequireChild
if ($avd.avd -ne 'codex_artwork_quality_20261012' -or $avd.serial -ne 'emulator-5580') { throw 'Only the isolated artwork AVD is authorized' }
$adb = Join-Path $toolchain.PlatformTools 'adb.exe'
$nameResult = & $adb -s $avd.serial emu avd name 2>&1
if ($LASTEXITCODE -ne 0 -or @($nameResult)[0].Trim() -ne $avd.avd) { throw 'Connected emulator identity differs from the task AVD' }
$boot = & $adb -s $avd.serial shell getprop sys.boot_completed
if ($LASTEXITCODE -ne 0 -or ([string]$boot).Trim() -ne '1') { throw 'Isolated AVD has not finished booting' }
if (-not $Output) { $Output = Join-Path $projectRoot ('release/codex_android_quality_20261012/runtime-' + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()) }
$outputRoot = [IO.Path]::GetFullPath($Output)
Assert-CodexPathWithin -BasePath (Join-Path $projectRoot 'release') -CandidatePath $outputRoot -RequireChild
if (Test-Path -LiteralPath $outputRoot) { throw 'Use a new runtime evidence directory' }
[void](New-Item -ItemType Directory -Path $outputRoot)
$result = [ordered]@{ passed=$false; serial=$avd.serial; avd=$avd.avd; output=$outputRoot;
    scope='Real Android API36 emulator with synthetic image fixtures; no user phone, personal AVD or archive'; steps=@() }
function Invoke-Checked([string]$Label, [string]$Program, [string[]]$Arguments) {
    $log = Join-Path $outputRoot ($Label + '.log')
    & $Program @Arguments *> $log
    $nativeExit = $LASTEXITCODE
    $script:result.steps += [ordered]@{ name=$Label; exit=$nativeExit; log=$log }
    if ($nativeExit -ne 0) { throw ($Label + ' failed; see ' + $log) }
}
try {
    Push-Location (Join-Path $projectRoot 'android')
    try {
        Invoke-Checked 'compile-image-runtime' (Join-Path (Get-Location) 'gradlew.bat') @('--init-script',
            (Join-Path $projectRoot 'scripts/gradle-mirrors.init.gradle'), ':app:assembleDebug', ':app:assembleDebugAndroidTest')
    } finally { Pop-Location }
    $applicationApk = Join-Path $projectRoot 'android/app/build/outputs/apk/debug/app-debug.apk'
    $testApk = Join-Path $projectRoot 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
    foreach ($apk in @($applicationApk, $testApk)) { if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) { throw ('Expected APK missing: ' + $apk) } }
    if ($SignedReleaseApk) {
        $applicationApk = (Resolve-Path -LiteralPath $SignedReleaseApk -ErrorAction Stop).ProviderPath
        Assert-CodexPathWithin -BasePath (Join-Path $projectRoot 'release') -CandidatePath $applicationApk -RequireChild
        $buildManifest = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $applicationApk) 'build_manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $officialSigner = '6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022'
        if ($buildManifest.packageId -ne 'com.yves.musicarchive' -or $buildManifest.signerSha256 -ne $officialSigner -or
                (Get-FileHash -LiteralPath $applicationApk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $buildManifest.apkSha256) {
            throw 'Release APK differs from the verified build manifest'
        }
        Invoke-Checked 'verify-release-signature' $toolchain.ApkSigner @('verify', '--verbose', '--print-certs', $applicationApk)
        $verified = Get-Content -LiteralPath (Join-Path $outputRoot 'verify-release-signature.log') -Raw
        if ($verified -notmatch ('Signer #1 certificate SHA-256 digest:\s*' + $officialSigner)) { throw 'Unexpected release certificate' }
        foreach ($name in @('XIAODONGGE_KEYSTORE_FILE', 'XIAODONGGE_KEYSTORE_PASSWORD', 'XIAODONGGE_KEY_ALIAS', 'XIAODONGGE_KEY_PASSWORD')) {
            if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))) {
                [Environment]::SetEnvironmentVariable($name, [Environment]::GetEnvironmentVariable($name, 'User'), 'Process')
            }
            if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))) { throw ('Signing configuration missing: ' + $name) }
        }
        $signedTests = Join-Path $outputRoot 'codex_artwork_signed_tests.apk'
        Invoke-Checked 'sign-image-tests' $toolchain.ApkSigner @('sign', '--ks', $env:XIAODONGGE_KEYSTORE_FILE,
            '--ks-key-alias', $env:XIAODONGGE_KEY_ALIAS, '--ks-pass', 'env:XIAODONGGE_KEYSTORE_PASSWORD',
            '--key-pass', 'env:XIAODONGGE_KEY_PASSWORD', '--out', $signedTests, $testApk)
        Invoke-Checked 'verify-image-test-signature' $toolchain.ApkSigner @('verify', '--verbose', '--print-certs', $signedTests)
        $verifiedTests = Get-Content -LiteralPath (Join-Path $outputRoot 'verify-image-test-signature.log') -Raw
        if ($verifiedTests -notmatch ('Signer #1 certificate SHA-256 digest:\s*' + $officialSigner)) { throw 'Unexpected test certificate' }
        $testApk = $signedTests
        $result.releaseApk = $applicationApk
        $result.releaseVersion = $buildManifest.versionName
        $result.signerSha256 = $officialSigner
        # This AVD was created by this task; remove only its synthetic debug installation before changing signer.
        Invoke-Checked 'remove-synthetic-debug-tests' $adb @('-s', $avd.serial, 'uninstall', 'com.yves.musicarchive.test')
        Invoke-Checked 'remove-synthetic-debug-app' $adb @('-s', $avd.serial, 'uninstall', 'com.yves.musicarchive')
    }
    $testBadging = & $toolchain.Aapt2 dump badging $testApk
    if ($LASTEXITCODE -ne 0) { throw 'Test APK badging failed' }
    $packageLine = @($testBadging | Where-Object { $_ -like 'package:*' })[0]
    $packageMatch = [regex]::Match($packageLine, "^package: name='([^']+)'")
    if (-not $packageMatch.Success) { throw 'Test APK package is missing' }
    $gradle = Get-Content -LiteralPath (Join-Path $projectRoot 'android/app/build.gradle') -Raw -Encoding UTF8
    $runner = [regex]::Match($gradle, 'testInstrumentationRunner\s+"([^"]+)"').Groups[1].Value
    if (-not $runner) { throw 'Instrumentation runner is missing' }
    $result.applicationApkSha256 = (Get-FileHash -LiteralPath $applicationApk -Algorithm SHA256).Hash.ToLowerInvariant()
    $result.testApkSha256 = (Get-FileHash -LiteralPath $testApk -Algorithm SHA256).Hash.ToLowerInvariant()
    Invoke-Checked 'install-image-app' $adb @('-s', $avd.serial, 'install', '-r', $applicationApk)
    Invoke-Checked 'install-image-tests' $adb @('-s', $avd.serial, 'install', '-r', $testApk)
    Invoke-Checked 'image-instrumentation' $adb @('-s', $avd.serial, 'shell', 'am', 'instrument', '-w', '-r',
        '-e', 'class', $TestClass, ($packageMatch.Groups[1].Value + '/' + $runner))
    $instrumentationLog = Get-Content -LiteralPath (Join-Path $outputRoot 'image-instrumentation.log') -Raw -Encoding UTF8
    if ($instrumentationLog -notmatch 'OK \((\d+) tests?\)' -or $instrumentationLog -match 'FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed') {
        throw 'Android instrumentation did not report all image tests passing'
    }
    $result.imageTests = [int][regex]::Match($instrumentationLog, 'OK \((\d+) tests?\)').Groups[1].Value
    $result.passed=$true
    Write-Output ('ARTWORK_ANDROID_PASSED tests=' + $result.imageTests + ' output=' + $outputRoot)
} catch {
    $result.error=$_.Exception.Message
    throw
} finally {
    $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputRoot 'codex_android_image_results.json') -Encoding UTF8
}
