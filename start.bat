@echo off
cd /d "%~dp0"
if not exist "node_modules\" (
  echo Run install.bat first.
  pause
  exit /b 1
)
echo Starting dev server... Open the URL shown below in browser.
echo.
call npm run dev
pause
