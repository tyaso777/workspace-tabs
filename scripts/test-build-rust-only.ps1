$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'build-rust-only.ps1'
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
