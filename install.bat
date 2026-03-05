@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo Install failed.
  pause
  exit /b 1
)
echo.
echo Done. Run start.bat to start the app.
pause
