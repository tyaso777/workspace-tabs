@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-rust-only.ps1" %*
exit /b %ERRORLEVEL%
