@echo off
cd /d "%~dp0"

set "PORT=8001"
set "PYTHON_EXE=%~dp0runtime\python\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo.
echo Starting Phase Diagram Assistant...
echo URL: http://127.0.0.1:%PORT%
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:%PORT%'"
cd /d "%~dp0backend"
"%PYTHON_EXE%" -m uvicorn main:app --host 127.0.0.1 --port %PORT%
pause
