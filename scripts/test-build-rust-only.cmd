@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-build-rust-only.ps1"
exit /b %ERRORLEVEL%
