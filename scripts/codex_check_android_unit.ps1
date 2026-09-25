param([string]$Output)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Output) { $Output = Join-Path $root ('release/codex_android_unit_' + [DateTime]::UtcNow.ToString('yyyyMMdd_HHmmss')) }
$outputDirectory = [IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $outputDirectory) { throw 'Use a new evidence directory' }
New-Item -ItemType Directory -Path $outputDirectory | Out-Null
$jdk = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot' }
$java = Join-Path $jdk 'bin/java.exe'
if (-not (Test-Path -LiteralPath $java)) { throw "JDK not found: $java" }
$env:JAVA_HOME = $jdk
$metadataPath = Join-Path $outputDirectory 'codex_classpath.json'
$init = Join-Path $outputDirectory 'codex_unit.init.gradle'
@'
gradle.projectsEvaluated {
    def app = gradle.rootProject.project(':app')
    def unit = app.tasks.named('testDebugUnitTest').get()
    app.tasks.register('codexUnitClasspath') {
        dependsOn unit.testClassesDirs, unit.classpath
        doLast {
            new File(System.getProperty('codex.unit.metadata')).setText(groovy.json.JsonOutput.toJson([
                classpath: unit.classpath.asPath,
                directories: unit.testClassesDirs.files.collect { it.absolutePath }
            ]), 'UTF-8')
        }
    }
}
'@ | Set-Content -LiteralPath $init -Encoding utf8
$result = @{ passed = $false; classes = @(); java = $java; output = $outputDirectory }
Push-Location (Join-Path $root 'android')
try {
    $gradleArgs = @('--init-script', (Join-Path $PSScriptRoot 'gradle-mirrors.init.gradle'), '--init-script', $init, "-Dcodex.unit.metadata=$metadataPath", ':app:codexUnitClasspath')
    & .\gradlew.bat @gradleArgs *> (Join-Path $outputDirectory 'compile.log')
    $result.compileExit = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) { throw "Android compilation failed; see $outputDirectory/compile.log" }
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    $classes = @(foreach ($directory in $metadata.directories) {
        if (-not (Test-Path -LiteralPath $directory)) { continue }
        Get-ChildItem -LiteralPath $directory -Recurse -File -Filter '*Test.class' | Where-Object { $_.Name -notlike '*$*' } | ForEach-Object {
            [IO.Path]::GetRelativePath($directory, $_.FullName).Replace('\', '.').Replace('/', '.').Replace('.class', '')
        }
    })
    if ($classes.Count -eq 0) { throw 'No compiled JUnit test classes found' }
    $result.classes = $classes
    # The JDK launcher misreads this workspace's Chinese path in Gradle's UTF-8 @argfile.
    # Pass the exact Gradle runtime classpath directly; all tests still use compiled Android classes.
    # ponytail: Windows command line is limited to 32767 characters; split into a classpath JAR if this grows.
    if ($metadata.classpath.Length -gt 28000) { throw 'JUnit classpath exceeds the direct Windows invocation bound' }
    $javaArgs = @('-cp', $metadata.classpath, 'org.junit.runner.JUnitCore') + $classes
    & $java @javaArgs *> (Join-Path $outputDirectory 'junit.log')
    $result.testExit = $LASTEXITCODE
    Get-Content -LiteralPath (Join-Path $outputDirectory 'junit.log')
    if ($result.testExit -ne 0) { throw 'JUnit tests failed' }
    $result.passed = $true
} catch {
    $result.error = $_.Exception.Message
    throw
} finally {
    Pop-Location
    $result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDirectory 'codex_android_results.json') -Encoding utf8
    Write-Output "Evidence: $outputDirectory"
}
