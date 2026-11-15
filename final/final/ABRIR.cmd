@echo off
cd /d "%~dp0.."
where python >nul 2>nul
if errorlevel 1 (
  echo Necesitas Python para iniciar el servidor local.
  pause
  exit /b 1
)
start "Servidor lunar" cmd /k "python -m http.server 8765 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/final/"
