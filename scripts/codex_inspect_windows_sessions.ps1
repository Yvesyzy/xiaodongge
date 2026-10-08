param([ValidateSet('Play', 'Pause')][string]$Control)
$ErrorActionPreference = 'Stop'
$nativePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\desktop\native\codex_windows_native.ps1'))
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($nativePath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Invalid native PowerShell source' }
# Load the checked-in functions and constants without running the action dispatcher or exit.
$definitions = $ast.EndBlock.Statements | Where-Object { $_ -isnot [System.Management.Automation.Language.TryStatementAst] }
. ([scriptblock]::Create(($definitions | ForEach-Object { $_.Extent.Text }) -join "`n"))
$types = Initialize-NativeTypes
$manager = Await-WinRt ($types.Manager::RequestAsync()) $types.Manager
if ($Control) {
    $cloud = @($manager.GetSessions()) | Where-Object { (Get-WinRtProperty $_ 'SourceAppUserModelId') -eq 'cloudmusic.exe' } | Select-Object -First 1
    if ($null -eq $cloud) { throw 'CloudMusic media session unavailable' }
    $operation = if ($Control -eq 'Play') { $cloud.TryPlayAsync() } else { $cloud.TryPauseAsync() }
    if (-not (Await-WinRt $operation ([bool]))) { throw 'CloudMusic rejected playback control' }
}
$current = $manager.GetCurrentSession()
$sessions = foreach ($session in $manager.GetSessions()) {
    $info = $session.GetPlaybackInfo()
    $media = Await-WinRt ($session.TryGetMediaPropertiesAsync()) $types.MediaProperties
    $properties = [ordered]@{}
    foreach ($property in $media.GetType().GetProperties()) {
        if ($property.Name -ne 'Thumbnail') { $properties[$property.Name] = [string]$property.GetValue($media, $null) }
    }
    [ordered]@{
        source = Get-WinRtProperty $session 'SourceAppUserModelId'
        current = ($null -ne $current -and (Get-WinRtProperty $current 'SourceAppUserModelId') -eq (Get-WinRtProperty $session 'SourceAppUserModelId'))
        playbackStatus = [string](Get-WinRtProperty $info 'PlaybackStatus')
        playbackMethods = @($session.GetType().GetMethods() | Where-Object Name -Match 'Try.*(Play|Pause)' | ForEach-Object Name)
        mediaProperties = $properties
    }
}
[ordered]@{ inspectedAt = [DateTimeOffset]::Now.ToString('o'); sessions = @($sessions) } | ConvertTo-Json -Depth 6
