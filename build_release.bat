@echo off
setlocal
cd /d "%~dp0"

set "OUT=release\phase-diagram-assistant-review"

echo [1/5] Building frontend...
call npm run build
if errorlevel 1 exit /b 1

echo [2/5] Recreating release folder...
if exist "release" rmdir /s /q "release"
mkdir "%OUT%"
if errorlevel 1 exit /b 1

echo [3/5] Copying app files...
robocopy "dist" "%OUT%\dist" /E >nul
if errorlevel 8 exit /b 1
robocopy "backend" "%OUT%\backend" /E /XD "__pycache__" ".pytest_cache" ".venv" "mcp" /XF "test_backend.py" >nul
if errorlevel 8 exit /b 1
robocopy "knowledge_docs" "%OUT%\knowledge_docs" /E >nul
if errorlevel 8 exit /b 1
copy /Y "start.bat" "%OUT%\start.bat" >nul
copy /Y "README_RELEASE.md" "%OUT%\README.md" >nul

echo [4/5] Copying optional runtime...
if exist "runtime" (
  robocopy "runtime" "%OUT%\runtime" /E >nul
  if errorlevel 8 exit /b 1
) else (
  echo runtime\python not found. Add an embedded Python runtime there for true unzip-and-run delivery.
)

echo [5/5] Done.
echo Release folder: %CD%\%OUT%
echo Zip this folder for judges after confirming runtime\python exists.
endlocal
