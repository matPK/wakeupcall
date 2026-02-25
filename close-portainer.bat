@echo off
setlocal

set "WINDOW_TITLE=Portainer Tunnel"

taskkill /FI "WINDOWTITLE eq %WINDOW_TITLE%*" /T /F >nul 2>&1
if errorlevel 1 (
  echo No "%WINDOW_TITLE%" window found.
  exit /b 1
)

echo Closed "%WINDOW_TITLE%".

