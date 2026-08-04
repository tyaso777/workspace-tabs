$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'build-rust-only.ps1'
$manifestPath = Join-Path $PSScriptRoot '..\explorer-shell\src-tauri\Cargo.toml'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("workspace-tabs-rust-only-test-" + [guid]::NewGuid())

function Invoke-Validation {
    param([string]$FrontendDist)

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
        -FrontendDist $FrontendDist -ValidateOnly 2> $null | Out-Null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousPreference
    return $exitCode
}

try {
    $buildScript = Get-Content -LiteralPath $scriptPath -Raw
    if ($buildScript -notmatch 'cargo build[^\r\n]+--features custom-protocol') {
        throw 'Desktop Rust-only build does not enable the production custom protocol.'
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw
    if ($manifest -notmatch 'custom-protocol\s*=\s*\[\s*"tauri/custom-protocol"\s*\]') {
        throw 'Cargo manifest does not map custom-protocol to tauri/custom-protocol.'
    }

    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    $missing = Join-Path $testRoot 'missing'
    if ((Invoke-Validation $missing) -eq 0) {
        throw 'Missing frontend artifact was accepted.'
    }

    $incomplete = Join-Path $testRoot 'incomplete'
    New-Item -ItemType Directory -Force -Path (Join-Path $incomplete 'assets') | Out-Null
    Set-Content -LiteralPath (Join-Path $incomplete 'index.html') -Value '<!doctype html>' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $incomplete 'assets\app.js') -Value 'export {};' -Encoding utf8
    if ((Invoke-Validation $incomplete) -eq 0) {
        throw 'Frontend artifact without CSS was accepted.'
    }

    Set-Content -LiteralPath (Join-Path $incomplete 'assets\app.css') -Value 'body {}' -Encoding utf8
    if ((Invoke-Validation $incomplete) -ne 0) {
        throw 'Complete frontend artifact was rejected.'
    }

    Write-Host 'npm-free frontend artifact validation tests passed.'
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
