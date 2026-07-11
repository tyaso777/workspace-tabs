param(
    [ValidateSet('desktop', 'local-web', 'all')]
    [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$shell = Join-Path $root 'explorer-shell'
$localWeb = Join-Path $root 'local-web'
$outputs = Join-Path $root 'outputs'

New-Item -ItemType Directory -Force -Path $outputs | Out-Null

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

function Build-Frontend {
    Invoke-Checked $shell { npm.cmd run build }
}

function Build-Desktop {
    Invoke-Checked $shell { npm.cmd run tauri build }
    Copy-Item -LiteralPath (Join-Path $shell 'src-tauri\target\release\workspace-tabs.exe') `
        -Destination (Join-Path $outputs 'workspace-tabs.exe') -Force
}

function Build-LocalWeb {
    Invoke-Checked $localWeb { cargo build --release }
    Copy-Item -LiteralPath (Join-Path $localWeb 'target\release\workspace-tabs-local-web.exe') `
        -Destination (Join-Path $outputs 'workspace-tabs-local-web.exe') -Force
}

switch ($Target) {
    'desktop' {
        Build-Desktop
    }
    'local-web' {
        Build-Frontend
        Build-LocalWeb
    }
    'all' {
        Build-Desktop
        Build-LocalWeb
    }
}

Write-Host "WorkspaceTabs build completed: $Target"
Get-ChildItem -LiteralPath $outputs -Filter 'workspace-tabs*.exe' |
    Select-Object Name, Length, LastWriteTime
