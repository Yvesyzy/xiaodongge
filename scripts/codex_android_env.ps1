function ConvertTo-CodexFullPath {
    param([Parameter(Mandatory)][string]$Path)
    return [IO.Path]::GetFullPath($Path)
}

function Test-CodexPathWithin {
    param(
        [Parameter(Mandatory)][string]$BasePath,
        [Parameter(Mandatory)][string]$CandidatePath,
        [switch]$RequireChild
    )
    $baseFull = ConvertTo-CodexFullPath $BasePath
    $candidateFull = ConvertTo-CodexFullPath $CandidatePath
    $prefix = $baseFull.TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
    $within = $candidateFull.Equals($baseFull, [StringComparison]::OrdinalIgnoreCase) -or
        $candidateFull.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
    if ($RequireChild) {
        $within = $within -and -not $candidateFull.Equals($baseFull, [StringComparison]::OrdinalIgnoreCase)
    }
    return $within
}

function Assert-CodexPathWithin {
    param(
        [Parameter(Mandatory)][string]$BasePath,
        [Parameter(Mandatory)][string]$CandidatePath,
        [switch]$RequireChild
    )
    if (-not (Test-CodexPathWithin -BasePath $BasePath -CandidatePath $CandidatePath -RequireChild:$RequireChild)) {
        throw "Refusing path outside allowed directory: $CandidatePath"
    }
}

function Assert-CodexNoLinks {
    param(
        [Parameter(Mandatory)][string]$BasePath,
        [Parameter(Mandatory)][string]$RelativePath
    )
    $baseFull = ConvertTo-CodexFullPath $BasePath
    $targetFull = ConvertTo-CodexFullPath (Join-Path $baseFull $RelativePath)
    Assert-CodexPathWithin -BasePath $baseFull -CandidatePath $targetFull -RequireChild

    $baseItem = Get-Item -LiteralPath $baseFull -Force -ErrorAction Stop
    if ($baseItem.LinkType -or (($baseItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
        throw "Refusing linked build path: $baseFull"
    }

    $current = $baseFull
    foreach ($part in ($RelativePath -split '[\\/]')) {
        if ([string]::IsNullOrWhiteSpace($part) -or $part -eq '.') { continue }
        if ($part -eq '..') { throw "Refusing parent traversal in relative path: $RelativePath" }
        $current = Join-Path $current $part
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if ($item.LinkType -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
                throw "Refusing linked build path: $current"
            }
        }
    }
}

function Remove-CodexGeneratedDirectory {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$RelativePath
    )
    $rootFull = ConvertTo-CodexFullPath $Root
    $targetFull = ConvertTo-CodexFullPath (Join-Path $rootFull $RelativePath)
    Assert-CodexPathWithin -BasePath $rootFull -CandidatePath $targetFull -RequireChild
    Assert-CodexNoLinks -BasePath $rootFull -RelativePath $RelativePath
    if (-not (Test-Path -LiteralPath $targetFull)) { return }
    if (-not (Test-Path -LiteralPath $targetFull -PathType Container)) {
        throw "Expected generated directory: $targetFull"
    }
    Remove-Item -LiteralPath $targetFull -Recurse -Force
}

function Get-CodexAndroidToolchain {
    param([switch]$RequireBuildTools)
    $sdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) {
        $env:ANDROID_HOME
    } else { 'C:\Users\lenovo\AppData\Local\Android\Sdk' }
    $jdk = if ($env:JAVA_HOME) { $env:JAVA_HOME } else {
        'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
    }
    $sdkFull = ConvertTo-CodexFullPath $sdk
    $jdkFull = ConvertTo-CodexFullPath $jdk
    if (-not (Test-Path -LiteralPath $sdkFull -PathType Container)) { throw "Android SDK not found: $sdkFull" }
    if (-not (Test-Path -LiteralPath $jdkFull -PathType Container)) { throw "JDK 21 not found: $jdkFull" }
    $buildTools = Join-Path $sdkFull 'build-tools\36.0.0'
    $toolchain = [pscustomobject]@{
        SdkRoot = $sdkFull
        JdkRoot = $jdkFull
        PlatformTools = Join-Path $sdkFull 'platform-tools'
        BuildTools = $buildTools
        ApkSigner = Join-Path $buildTools 'apksigner.bat'
        Aapt2 = Join-Path $buildTools 'aapt2.exe'
    }
    if ($RequireBuildTools) {
        foreach ($required in @($toolchain.ApkSigner, $toolchain.Aapt2)) {
            if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
                throw "Required Android build tool is missing: $required"
            }
        }
    }
    return $toolchain
}

function Set-CodexAndroidEnvironment {
    param([Parameter(Mandatory)]$Toolchain)
    $env:JAVA_HOME = $Toolchain.JdkRoot
    $env:ANDROID_HOME = $Toolchain.SdkRoot
    $env:ANDROID_SDK_ROOT = $Toolchain.SdkRoot
    $env:Path = @(
        (Join-Path $Toolchain.JdkRoot 'bin'),
        $Toolchain.PlatformTools,
        $Toolchain.BuildTools,
        $env:Path
    ) -join ';'
}
