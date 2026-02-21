@echo off
setlocal

cd /d "%~dp0"
npm run bot

if errorlevel 1 (
  echo.
  echo Bot exited with an error.
)

echo.
pause
