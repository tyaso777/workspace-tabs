param(
    [ValidateSet('desktop', 'local-web', 'all')]
    [string]$Target = 'all',
    [string]$FrontendDist = '',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$shell = Join-Path $root 'explorer-shell'
$localWeb = Join-Path $root 'local-web'
$outputs = Join-Path $root 'outputs'

if ([string]::IsNullOrWhiteSpace($FrontendDist)) {
    $FrontendDist = Join-Path $shell 'dist'
}
elseif (-not [System.IO.Path]::IsPathRooted($FrontendDist)) {
    $FrontendDist = Join-Path $root $FrontendDist
}
$FrontendDist = [System.IO.Path]::GetFullPath($FrontendDist)

function Assert-FrontendDist {
    param([string]$Path)

    $index = Join-Path $Path 'index.html'
    $assets = Join-Path $Path 'assets'
    if (-not (Test-Path -LiteralPath $index -PathType Leaf)) {
        throw "Frontend artifact is missing: $index`nBuild it on a machine with Node.js, then copy explorer-shell\dist to this location."
    }
    if (-not (Test-Path -LiteralPath $assets -PathType Container)) {
        throw "Frontend assets folder is missing: $assets"
    }
    if (-not (Get-ChildItem -LiteralPath $assets -Filter '*.js' -File -Recurse | Select-Object -First 1)) {
        throw "Frontend JavaScript is missing under: $assets"
    }
    if (-not (Get-ChildItem -LiteralPath $assets -Filter '*.css' -File -Recurse | Select-Object -First 1)) {
        throw "Frontend CSS is missing under: $assets"
    }
}

function Invoke-Checked {
    param(
        [string]$WorkingDirectory,
        [scriptblock]$Command
    )

    Push-Location $WorkingDirectory
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) {
            throw "Build command failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Build-Desktop {
    Invoke-Checked $root {
        cargo build --release --locked --manifest-path explorer-shell/src-tauri/Cargo.toml
    }
    Copy-Item -LiteralPath (Join-Path $shell 'src-tauri\target\release\workspace-tabs.exe') `
        -Destination (Join-Path $outputs 'workspace-tabs.exe') -Force
}

function Build-LocalWeb {
    Invoke-Checked $root {
        cargo build --release --locked --manifest-path local-web/Cargo.toml
    }
    Copy-Item -LiteralPath (Join-Path $localWeb 'target\release\workspace-tabs-local-web.exe') `
        -Destination (Join-Path $outputs 'workspace-tabs-local-web.exe') -Force
}

Assert-FrontendDist $FrontendDist
Write-Host "Frontend artifact validated: $FrontendDist"
if ($ValidateOnly) {
    exit 0
}

$expectedDist = [System.IO.Path]::GetFullPath((Join-Path $shell 'dist'))
if (-not $FrontendDist.Equals($expectedDist, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Rust builds require the frontend artifact at: $expectedDist`nCopy the validated artifact there before building."
}

New-Item -ItemType Directory -Force -Path $outputs | Out-Null
switch ($Target) {
    'desktop' { Build-Desktop }
    'local-web' { Build-LocalWeb }
    'all' {
        Build-Desktop
        Build-LocalWeb
    }
}

Write-Host "WorkspaceTabs npm-free Rust build completed: $Target"
Get-ChildItem -LiteralPath $outputs -Filter 'workspace-tabs*.exe' |
    Select-Object Name, Length, LastWriteTime
