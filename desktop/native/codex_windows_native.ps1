[CmdletBinding()]
param(
    [string]$Action,
    [string]$InputPath
)

$ErrorActionPreference = 'Stop'
$script:WaitTimeoutMs = 15000
$script:MaxOcrInputBytes = 12 * 1024 * 1024
# ponytail: 24,000,000 pixels caps the 4-byte Bgra8 conversion at 96 MB; raise only after repeating memory tests.
$script:MaxOcrPixels = 24000000
$script:NativeTypes = $null

function Get-WinRtType([string]$TypeName) {
    $type = [Type]::GetType($TypeName)
    if ($null -eq $type) {
        throw "WinRT type is unavailable: $TypeName"
    }
    return $type
}

function Get-WinRtProperty([object]$Object, [string]$PropertyName) {
    if ($null -eq $Object) {
        return $null
    }
    $property = $Object.GetType().GetProperty($PropertyName)
    if ($null -eq $property) {
        throw "WinRT property is unavailable: $PropertyName"
    }
    return $property.GetValue($Object, $null)
}

function Get-WinRtField([object]$Object, [string]$FieldName, [Type]$DeclaredType) {
    if ($null -eq $Object) {
        return $null
    }
    $member = $Object.PSObject.Properties[$FieldName]
    if ($null -ne $member) {
        return $member.Value
    }
    $field = $Object.GetType().GetField($FieldName)
    if ($null -eq $field -and $null -ne $DeclaredType) {
        $field = $DeclaredType.GetField($FieldName)
    }
    if ($null -eq $field) {
        throw "WinRT field is unavailable: $FieldName"
    }
    return $field.GetValue($Object)
}

function Initialize-NativeTypes {
    if ($null -ne $script:NativeTypes) {
        return $script:NativeTypes
    }

    Add-Type -AssemblyName 'System.Runtime.WindowsRuntime'
    $script:NativeTypes = [ordered]@{
        Manager = Get-WinRtType 'Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows, ContentType=WindowsRuntime'
        MediaProperties = Get-WinRtType 'Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows, ContentType=WindowsRuntime'
        OcrEngine = Get-WinRtType 'Windows.Media.Ocr.OcrEngine, Windows, ContentType=WindowsRuntime'
        OcrResult = Get-WinRtType 'Windows.Media.Ocr.OcrResult, Windows, ContentType=WindowsRuntime'
        StorageFile = Get-WinRtType 'Windows.Storage.StorageFile, Windows, ContentType=WindowsRuntime'
        FileAccessMode = Get-WinRtType 'Windows.Storage.FileAccessMode, Windows, ContentType=WindowsRuntime'
        RandomAccessStream = Get-WinRtType 'Windows.Storage.Streams.IRandomAccessStream, Windows, ContentType=WindowsRuntime'
        BitmapDecoder = Get-WinRtType 'Windows.Graphics.Imaging.BitmapDecoder, Windows, ContentType=WindowsRuntime'
        SoftwareBitmap = Get-WinRtType 'Windows.Graphics.Imaging.SoftwareBitmap, Windows, ContentType=WindowsRuntime'
        BitmapPixelFormat = Get-WinRtType 'Windows.Graphics.Imaging.BitmapPixelFormat, Windows, ContentType=WindowsRuntime'
        BitmapAlphaMode = Get-WinRtType 'Windows.Graphics.Imaging.BitmapAlphaMode, Windows, ContentType=WindowsRuntime'
        Rect = Get-WinRtType 'Windows.Foundation.Rect, Windows, ContentType=WindowsRuntime'
    }
    return $script:NativeTypes
}

function Await-WinRt([object]$Operation, [Type]$ResultType) {
    if ($null -eq $Operation) {
        throw 'WinRT operation was null'
    }

    $asTaskDefinition = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.IsGenericMethodDefinition -and
            $_.GetGenericArguments().Count -eq 1 -and
            $_.GetParameters().Count -eq 1
        } |
        Select-Object -First 1
    if ($null -eq $asTaskDefinition) {
        throw 'Windows Runtime async bridge is unavailable'
    }

    $asTaskMethod = $asTaskDefinition.MakeGenericMethod($ResultType)
    $task = $asTaskMethod.Invoke($null, @($Operation))
    if ($null -eq $task) {
        throw 'WinRT async bridge returned no task'
    }
    $completed = $task.Wait($script:WaitTimeoutMs)
    if (-not $completed) {
        throw "WinRT operation timed out after $($script:WaitTimeoutMs) ms"
    }
    return $task.GetAwaiter().GetResult()
}

function Get-OptionalText([object]$Value) {
    if ($null -eq $Value) {
        return $null
    }
    $text = ([string]$Value).Trim()
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }
    return $text
}

function Get-ErrorText([object]$ErrorRecord) {
    $exception = $ErrorRecord.Exception
    if ($null -eq $exception) {
        return ([string]$ErrorRecord).Trim()
    }
    while ($null -ne $exception.InnerException) {
        $exception = $exception.InnerException
    }
    $message = ([string]$exception.Message).Trim()
    if ([string]::IsNullOrWhiteSpace($message)) {
        return $exception.GetType().FullName
    }
    return $message
}

function Test-PlayingSession([object]$Session) {
    if ($null -eq $Session) {
        return $false
    }
    try {
        $playbackInfo = $Session.GetPlaybackInfo()
        return ($null -ne $playbackInfo -and [string](Get-WinRtProperty $playbackInfo 'PlaybackStatus') -eq 'Playing')
    } catch {
        return $false
    }
}

function Select-PlayingSession([object]$Manager) {
    $currentSession = $null
    try {
        $currentSession = $Manager.GetCurrentSession()
    } catch {
        $currentSession = $null
    }
    if (Test-PlayingSession $currentSession) {
        return $currentSession
    }

    $sessions = $Manager.GetSessions()
    if ($null -eq $sessions) {
        return $null
    }
    foreach ($session in $sessions) {
        if (Test-PlayingSession $session) {
            return $session
        }
    }
    return $null
}

function Get-NowPlaying {
    $types = Initialize-NativeTypes
    $managerRequest = $types.Manager::RequestAsync()
    $manager = Await-WinRt $managerRequest $types.Manager
    if ($null -eq $manager) {
        throw 'Windows media session manager returned no value'
    }

    $empty = [ordered]@{ accessEnabled = $true }
    $session = Select-PlayingSession $manager
    if ($null -eq $session) {
        return $empty
    }

    $mediaProperties = $null
    try {
        $mediaPropertiesRequest = $session.TryGetMediaPropertiesAsync()
        $mediaProperties = Await-WinRt $mediaPropertiesRequest $types.MediaProperties
        if ($null -eq $mediaProperties) {
            return $empty
        }
        $title = Get-OptionalText (Get-WinRtProperty $mediaProperties 'Title')
        if ($null -eq $title) {
            return $empty
        }
    } catch {
        return $empty
    }

    $result = [ordered]@{
        accessEnabled = $true
        title = $title
    }
    try {
        $artistName = Get-OptionalText (Get-WinRtProperty $mediaProperties 'Artist')
        if ($null -ne $artistName) {
            $result['artistName'] = $artistName
        }
    } catch { }
    try {
        $albumName = Get-OptionalText (Get-WinRtProperty $mediaProperties 'AlbumTitle')
        if ($null -ne $albumName) {
            $result['albumName'] = $albumName
        }
    } catch { }

    $musicMetadata = [ordered]@{
        displayTitle = $title
    }
    try {
        $albumArtistName = Get-OptionalText (Get-WinRtProperty $mediaProperties 'AlbumArtist')
        if ($null -ne $albumArtistName) {
            $musicMetadata['albumArtistName'] = $albumArtistName
        }
    } catch { }
    try {
        $sourcePackage = Get-OptionalText (Get-WinRtProperty $session 'SourceAppUserModelId')
        if ($null -ne $sourcePackage) {
            $musicMetadata['sourcePackage'] = $sourcePackage
        }
    } catch { }
    try {
        $trackNumber = [int](Get-WinRtProperty $mediaProperties 'TrackNumber')
        if ($trackNumber -gt 0) {
            $musicMetadata['trackNumber'] = $trackNumber
        }
    } catch { }
    try {
        $trackCount = [int](Get-WinRtProperty $mediaProperties 'AlbumTrackCount')
        if ($trackCount -gt 0) {
            $musicMetadata['trackCount'] = $trackCount
        }
    } catch { }
    try {
        $timeline = $session.GetTimelineProperties()
        if ($null -ne $timeline) {
            $endTime = Get-WinRtProperty $timeline 'EndTime'
            $startTime = Get-WinRtProperty $timeline 'StartTime'
            $duration = ($endTime - $startTime).TotalMilliseconds
            if ($duration -gt 0) {
                $musicMetadata['durationMs'] = [long][Math]::Round($duration)
            }
        }
    } catch { }
    $result['musicMetadata'] = $musicMetadata
    return $result
}

function Get-OcrEngine([System.Collections.IDictionary]$Types) {
    $engine = $Types.OcrEngine::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine) {
        throw 'No OCR engine is available for the user profile languages'
    }
    return $engine
}

function Get-OcrDiagnostics([System.Collections.IDictionary]$Result, [System.Collections.IDictionary]$Types) {
    try {
        $engine = Get-OcrEngine $Types
        $languageTags = New-Object 'System.Collections.Generic.List[string]'
        $availableLanguages = Get-WinRtProperty $engine 'AvailableRecognizerLanguages'
        foreach ($language in $availableLanguages) {
            $tag = Get-OptionalText (Get-WinRtProperty $language 'LanguageTag')
            if ($null -ne $tag) {
                [void]$languageTags.Add($tag)
            }
        }
        $Result['ocrAvailable'] = $true
        $Result['ocrLanguages'] = @($languageTags.ToArray())
        $Result['ocrMaxImageDimension'] = [int64](Get-WinRtProperty $engine 'MaxImageDimension')
    } catch {
        $Result['ocrError'] = Get-ErrorText $_
    }
}

function Get-Diagnostics {
    $result = [ordered]@{
        nativeAvailable = $false
        mediaAvailable = $false
        mediaSessionCount = 0
        ocrAvailable = $false
        ocrLanguages = @()
        ocrMaxImageDimension = 0
    }
    try {
        $types = Initialize-NativeTypes
        $result['nativeAvailable'] = $true
    } catch {
        $result['nativeError'] = Get-ErrorText $_
        return $result
    }

    try {
        $managerRequest = $types.Manager::RequestAsync()
        $manager = Await-WinRt $managerRequest $types.Manager
        $result['mediaAvailable'] = $true
        if ($null -ne $manager) {
            foreach ($session in $manager.GetSessions()) {
                $result['mediaSessionCount'] = [int]$result['mediaSessionCount'] + 1
            }
        }
    } catch {
        $result['mediaError'] = Get-ErrorText $_
    }

    Get-OcrDiagnostics $result $types
    return $result
}

function Invoke-Ocr([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw 'InputPath is required for OCR'
    }
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (-not [System.IO.File]::Exists($fullPath)) {
        throw "InputPath does not identify a file: $fullPath"
    }
    $fileInfo = Get-Item -LiteralPath $fullPath -ErrorAction Stop
    if ([int64]$fileInfo.Length -gt $script:MaxOcrInputBytes) {
        throw "InputPath exceeds OCR file limit of $($script:MaxOcrInputBytes) bytes"
    }

    $types = Initialize-NativeTypes
    $engine = Get-OcrEngine $types
    $maxDimension = [int64](Get-WinRtProperty $engine 'MaxImageDimension')
    if ($maxDimension -le 0) {
        throw 'OCR engine reported no usable maximum image dimension'
    }

    $stream = $null
    $bitmap = $null
    try {
        $fileRequest = $types.StorageFile::GetFileFromPathAsync($fullPath)
        $file = Await-WinRt $fileRequest $types.StorageFile
        $streamRequest = $file.OpenAsync($types.FileAccessMode::Read)
        $stream = Await-WinRt $streamRequest $types.RandomAccessStream
        $decoderRequest = $types.BitmapDecoder::CreateAsync($stream)
        $decoder = Await-WinRt $decoderRequest $types.BitmapDecoder

        $decodedWidth = [int64](Get-WinRtProperty $decoder 'OrientedPixelWidth')
        $decodedHeight = [int64](Get-WinRtProperty $decoder 'OrientedPixelHeight')
        if ($decodedWidth -le 0 -or $decodedHeight -le 0) {
            throw 'Image dimensions are zero'
        }
        if ($decodedWidth -gt $maxDimension -or $decodedHeight -gt $maxDimension) {
            throw "Image dimensions ${decodedWidth}x${decodedHeight} exceed OCR maximum $maxDimension"
        }
        $decodedPixels = ([int64]$decodedWidth) * ([int64]$decodedHeight)
        if ($decodedPixels -gt $script:MaxOcrPixels) {
            throw "Image pixel count $decodedPixels exceeds OCR limit of $($script:MaxOcrPixels)"
        }

        $bitmapRequest = $decoder.GetSoftwareBitmapAsync($types.BitmapPixelFormat::Bgra8, $types.BitmapAlphaMode::Premultiplied)
        $bitmap = Await-WinRt $bitmapRequest $types.SoftwareBitmap
        $width = [int64](Get-WinRtProperty $bitmap 'PixelWidth')
        $height = [int64](Get-WinRtProperty $bitmap 'PixelHeight')
        if ($width -le 0 -or $height -le 0) {
            throw 'Decoded image dimensions are zero'
        }
        if ($width -gt $maxDimension -or $height -gt $maxDimension) {
            throw "Decoded image dimensions ${width}x${height} exceed OCR maximum $maxDimension"
        }
        $decodedBitmapPixels = ([int64]$width) * ([int64]$height)
        if ($decodedBitmapPixels -gt $script:MaxOcrPixels) {
            throw "Decoded image pixel count $decodedBitmapPixels exceeds OCR limit of $($script:MaxOcrPixels)"
        }

        $ocrRequest = $engine.RecognizeAsync($bitmap)
        $ocrResult = Await-WinRt $ocrRequest $types.OcrResult
        if ($null -eq $ocrResult) {
            throw 'OCR returned no result'
        }
        $text = [string](Get-WinRtProperty $ocrResult 'Text')
        if ([string]::IsNullOrWhiteSpace($text)) {
            throw 'OCR returned no text'
        }

        $lineResults = New-Object 'System.Collections.Generic.List[object]'
        $ocrLines = Get-WinRtProperty $ocrResult 'Lines'
        foreach ($line in $ocrLines) {
            $lineText = Get-OptionalText (Get-WinRtProperty $line 'Text')
            if ($null -eq $lineText) {
                continue
            }
            $left = [double]::PositiveInfinity
            $top = [double]::PositiveInfinity
            $right = [double]::NegativeInfinity
            $bottom = [double]::NegativeInfinity
            $hasWord = $false
            $ocrWords = Get-WinRtProperty $line 'Words'
            foreach ($word in $ocrWords) {
                $rect = Get-WinRtProperty $word 'BoundingRect'
                $x = [double](Get-WinRtField $rect 'X' $types.Rect)
                $y = [double](Get-WinRtField $rect 'Y' $types.Rect)
                $wordRight = $x + [double](Get-WinRtField $rect 'Width' $types.Rect)
                $wordBottom = $y + [double](Get-WinRtField $rect 'Height' $types.Rect)
                $left = [Math]::Min($left, $x)
                $top = [Math]::Min($top, $y)
                $right = [Math]::Max($right, $wordRight)
                $bottom = [Math]::Max($bottom, $wordBottom)
                $hasWord = $true
            }
            if (-not $hasWord) {
                continue
            }
            $lineResults.Add([ordered]@{
                text = $lineText
                left = $left
                top = $top
                right = $right
                bottom = $bottom
            })
        }

        return [ordered]@{
            text = $text
            width = $width
            height = $height
            lines = @($lineResults.ToArray())
        }
    } finally {
        if ($null -ne $bitmap) {
            try { $bitmap.Dispose() } catch { }
        }
        if ($null -ne $stream) {
            try { $stream.Dispose() } catch { }
        }
    }
}

function Write-Utf8Bytes([byte[]]$Bytes, [bool]$ErrorStream) {
    $stream = if ($ErrorStream) { [Console]::OpenStandardError() } else { [Console]::OpenStandardOutput() }
    try {
        $stream.Write($Bytes, 0, $Bytes.Length)
        $stream.Flush()
    } finally {
        $stream.Dispose()
    }
}

function Write-JsonUtf8([object]$Value) {
    $json = ConvertTo-Json -InputObject $Value -Compress -Depth 12
    $encoding = New-Object System.Text.UTF8Encoding($false)
    Write-Utf8Bytes ($encoding.GetBytes($json)) $false
}

function Write-ErrorUtf8([string]$Message) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    Write-Utf8Bytes ($encoding.GetBytes($Message + [Environment]::NewLine)) $true
}

try {
    $validActions = @('nowPlaying', 'ocr', 'diagnostics')
    $isValidAction = $false
    foreach ($validAction in $validActions) {
        if ([StringComparer]::Ordinal.Equals($Action, $validAction)) {
            $isValidAction = $true
            break
        }
    }
    if (-not $isValidAction) {
        throw 'Action must be one of nowPlaying, ocr, diagnostics'
    }

    switch ($Action) {
        'nowPlaying' {
            $output = Get-NowPlaying
            break
        }
        'ocr' {
            $output = Invoke-Ocr $InputPath
            break
        }
        'diagnostics' {
            $output = Get-Diagnostics
            break
        }
    }

    Write-JsonUtf8 $output
    exit 0
} catch {
    Write-ErrorUtf8 (Get-ErrorText $_)
    exit 1
}
