@echo off
setlocal

set "TARGET=all"
if /I "%~1"=="-Target" set "TARGET=%~2"
if /I "%~1"=="desktop" set "TARGET=desktop"
if /I "%~1"=="local-web" set "TARGET=local-web"
if /I "%~1"=="all" set "TARGET=all"

if /I "%TARGET%"=="desktop" goto desktop_only
if /I "%TARGET%"=="local-web" goto local_web_only
if /I "%TARGET%"=="all" goto all

echo Unknown target: %TARGET%
echo Use desktop, local-web, or all.
exit /b 2

:desktop_only
call :build_desktop
if errorlevel 1 exit /b %ERRORLEVEL%
goto success

:local_web_only
call :build_frontend
if errorlevel 1 exit /b %ERRORLEVEL%
call :build_local_web
if errorlevel 1 exit /b %ERRORLEVEL%
goto success

:all
call :build_desktop
if errorlevel 1 exit /b %ERRORLEVEL%
call :build_local_web
if errorlevel 1 exit /b %ERRORLEVEL%
goto success

:build_frontend
pushd "%~dp0..\explorer-shell"
call npm.cmd run build
set "RESULT=%ERRORLEVEL%"
popd
exit /b %RESULT%

:build_desktop
pushd "%~dp0..\explorer-shell"
call npm.cmd run tauri build
set "RESULT=%ERRORLEVEL%"
popd
if not "%RESULT%"=="0" exit /b %RESULT%
if not exist "%~dp0..\outputs" mkdir "%~dp0..\outputs"
copy /Y "%~dp0..\explorer-shell\src-tauri\target\release\workspace-tabs.exe" "%~dp0..\outputs\workspace-tabs.exe" >nul
if errorlevel 1 exit /b %ERRORLEVEL%
exit /b 0

:build_local_web
pushd "%~dp0..\local-web"
cargo build --release
set "RESULT=%ERRORLEVEL%"
popd
if not "%RESULT%"=="0" exit /b %RESULT%
if not exist "%~dp0..\outputs" mkdir "%~dp0..\outputs"
copy /Y "%~dp0..\local-web\target\release\workspace-tabs-local-web.exe" "%~dp0..\outputs\workspace-tabs-local-web.exe" >nul
exit /b %ERRORLEVEL%

:success
echo WorkspaceTabs build completed: %TARGET%
dir /B "%~dp0..\outputs\workspace-tabs*.exe"
exit /b 0
