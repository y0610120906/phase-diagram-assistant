@echo off
setlocal
cd /d "%~dp0"

set "PYDIR=%~dp0runtime\python"
set "PY=%PYDIR%\python.exe"

if not exist "%PY%" (
  echo Embedded Python was not found:
  echo   %PY%
  echo.
  echo Download the Windows embeddable Python zip, extract it to runtime\python,
  echo then run this script again.
  exit /b 1
)

echo Enabling site packages for embedded Python...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pth = Get-ChildItem -LiteralPath '%PYDIR%' -Filter 'python*._pth' | Select-Object -First 1; if ($pth) { (Get-Content -LiteralPath $pth.FullName) -replace '^#import site$', 'import site' | Set-Content -LiteralPath $pth.FullName -Encoding ASCII }"

if not exist "%PYDIR%\Scripts\pip.exe" (
  echo Installing pip...
  if not exist "get-pip.py" (
    echo get-pip.py not found. Download it from https://bootstrap.pypa.io/get-pip.py
    echo and place it in the project root, then run this script again.
    exit /b 1
  )
  "%PY%" get-pip.py
  if errorlevel 1 exit /b 1
)

echo Installing backend dependencies into embedded Python...
"%PY%" -m pip install -r backend\requirements.txt
if errorlevel 1 exit /b 1

echo Runtime is ready:
echo   %PY%
endlocal
