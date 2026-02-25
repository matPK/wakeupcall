@echo off
setlocal

set "VPS_USER=ubuntu"
set "VPS_HOST=YOUR_VPS_HOST_OR_IP"
set "LOCAL_PORT=19443"
set "REMOTE_PORT=9443"
set "SSH_KEY_PATH="
set "WINDOW_TITLE=Portainer Tunnel"

if "%VPS_HOST%"=="YOUR_VPS_HOST_OR_IP" (
  echo Please edit this file and set VPS_HOST first.
  exit /b 1
)

where ssh >nul 2>&1
if errorlevel 1 (
  echo ssh was not found in PATH. Install OpenSSH client first.
  exit /b 1
)

if defined SSH_KEY_PATH (
  start "%WINDOW_TITLE%" cmd /k ssh -i "%SSH_KEY_PATH%" -N -L %LOCAL_PORT%:127.0.0.1:%REMOTE_PORT% %VPS_USER%@%VPS_HOST%
) else (
  start "%WINDOW_TITLE%" cmd /k ssh -N -L %LOCAL_PORT%:127.0.0.1:%REMOTE_PORT% %VPS_USER%@%VPS_HOST%
)

timeout /t 2 /nobreak >nul
start "" "https://127.0.0.1:%LOCAL_PORT%"

