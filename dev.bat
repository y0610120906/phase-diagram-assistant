@echo off
cd /d "%~dp0"

echo Starting Backend...
start "Backend" /D "%~dp0backend" cmd /k python -m uvicorn main:app --host 127.0.0.1 --port 8001

echo Starting Frontend...
start "Frontend" /D "%~dp0" cmd /k npm run dev

echo.
echo Backend : http://127.0.0.1:8001
echo Frontend: http://127.0.0.1:5173
echo.
echo If either child window shows an error, keep it open and fix that message first.
pause
