param(
  [string]$ExePath = "$PSScriptRoot\..\src-tauri\target\release\workspace-tabs.exe",
  [int]$OuterWidth = 1220,
  [int]$OuterHeight = 720,
  [int]$Tolerance = 8
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  $executionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
}

function Stop-App([string]$ProcessName) {
  Get-Process $ProcessName -ErrorAction SilentlyContinue | Stop-Process
}

function Start-App([string]$Path, [string]$ProcessName) {
  Start-Process -FilePath $Path -WindowStyle Normal
  Start-Sleep -Seconds 4
  $process = Get-Process $ProcessName -ErrorAction Stop | Select-Object -First 1
  if ($process.MainWindowHandle -eq 0) {
    throw "$ProcessName started, but MainWindowHandle is 0."
  }
  $process
}

function Read-WindowRect($Handle) {
  $rect = New-Object RECT
  [Win32Window]::GetWindowRect($Handle, [ref]$rect) | Out-Null
  $rect
}

function Read-WindowWidth($Handle) {
  $rect = Read-WindowRect $Handle
  $rect.Right - $rect.Left
}

function Read-WindowHeight($Handle) {
  $rect = Read-WindowRect $Handle
  $rect.Bottom - $rect.Top
}

function Assert-Near([string]$Name, [int]$Actual, [int]$Expected, [int]$AllowedDelta) {
  $delta = [Math]::Abs($Actual - $Expected)
  if ($delta -gt $AllowedDelta) {
    throw "$Name expected near $Expected (+/- $AllowedDelta), but got $Actual."
  }
}

$exeFullPath = Resolve-FullPath $ExePath
if (-not (Test-Path -LiteralPath $exeFullPath)) {
  throw "Executable not found: $exeFullPath. Run npm.cmd run tauri build first."
}

$exeDir = Split-Path -Parent $exeFullPath
$processName = [System.IO.Path]::GetFileNameWithoutExtension($exeFullPath)
$dataDir = Join-Path $exeDir "data"
$dbPath = Join-Path $dataDir "workspace.sqlite3"
$createdDataDir = $false

if (Test-Path -LiteralPath $dataDir) {
  throw "Refusing to run: portable data folder already exists at $dataDir. Move it before running this E2E test."
}

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Window {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
'@

try {
  Stop-App $processName
  New-Item -ItemType Directory -Path $dataDir | Out-Null
  $createdDataDir = $true

  $process = Start-App $exeFullPath $processName
  [Win32Window]::MoveWindow($process.MainWindowHandle, 80, 80, $OuterWidth, $OuterHeight, $true) | Out-Null
  Start-Sleep -Seconds 2
  $process.CloseMainWindow() | Out-Null
  Start-Sleep -Seconds 2

  if (-not (Test-Path -LiteralPath $dbPath)) {
    throw "Expected portable database was not created: $dbPath"
  }

  $srcTauriDir = Resolve-FullPath "$PSScriptRoot\..\src-tauri"
  $savedWidthText = cargo run --quiet --example read_app_state --manifest-path "$srcTauriDir\Cargo.toml" -- "$dbPath" window_width
  $savedHeightText = cargo run --quiet --example read_app_state --manifest-path "$srcTauriDir\Cargo.toml" -- "$dbPath" window_height
  $savedWidth = [int]$savedWidthText.Trim()
  $savedHeight = [int]$savedHeightText.Trim()
  if ($savedWidth -lt ($OuterWidth - 80) -or $savedWidth -gt $OuterWidth) {
    throw "Saved window_width expected between $($OuterWidth - 80) and $OuterWidth, but got $savedWidth."
  }
  if ($savedHeight -lt ($OuterHeight - 80) -or $savedHeight -gt $OuterHeight) {
    throw "Saved window_height expected between $($OuterHeight - 80) and $OuterHeight, but got $savedHeight."
  }

  $process = Start-App $exeFullPath $processName
  $restoredWidth = Read-WindowWidth $process.MainWindowHandle
  $restoredHeight = Read-WindowHeight $process.MainWindowHandle
  Assert-Near "Restored outer width" $restoredWidth $OuterWidth $Tolerance
  Assert-Near "Restored outer height" $restoredHeight $OuterHeight $Tolerance
  $process.CloseMainWindow() | Out-Null
  Start-Sleep -Seconds 1

  Write-Host "E2E window size passed: saved window_width=$savedWidth, saved window_height=$savedHeight, restored outer_width=$restoredWidth, restored outer_height=$restoredHeight"
} finally {
  Stop-App $processName
  if ($createdDataDir -and (Test-Path -LiteralPath $dataDir)) {
    Remove-Item -LiteralPath $dataDir -Recurse -Force
  }
}
