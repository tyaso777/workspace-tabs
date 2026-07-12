param(
    [int]$Port = 47891
)

$ErrorActionPreference = 'Stop'
$shell = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $shell
$sourceExe = Join-Path $root 'local-web\target\debug\workspace-tabs-local-web.exe'
$runtime = Join-Path $shell '.e2e-runtime'
$data = Join-Path $runtime 'data'
$runtimeExe = Join-Path $runtime 'workspace-tabs-local-web.exe'

if (-not (Test-Path -LiteralPath $sourceExe)) {
    throw "Local Web debug executable not found: $sourceExe"
}

if (Test-Path -LiteralPath $runtime) {
    $resolvedRuntime = [System.IO.Path]::GetFullPath($runtime)
    $resolvedShell = [System.IO.Path]::GetFullPath($shell)
    if (-not $resolvedRuntime.StartsWith($resolvedShell, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove E2E runtime outside explorer-shell: $resolvedRuntime"
    }
    Remove-Item -LiteralPath $runtime -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $data | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $runtimeExe -Force

& $runtimeExe --port $Port --no-browser
exit $LASTEXITCODE
