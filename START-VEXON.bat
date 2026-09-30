@echo off
setlocal
cd /d "%~dp0"
title VEXON - Hasnain Sir
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is not installed. Install Node.js LTS from https://nodejs.org
 echo Then double-click START-VEXON.bat again.
 pause
 exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 (
 echo Node.js 22 or newer is required. Update from https://nodejs.org
 pause
 exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
 echo Installing VEXON dependencies. First launch needs internet.
 call npm ci --no-audit --no-fund
 if errorlevel 1 goto failed
 if not exist "node_modules\electron\dist\electron.exe" (
  call node node_modules\electron\install.js
  if errorlevel 1 goto failed
 )
)
echo Starting VEXON...
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo VEXON could not start. Keep this window open and send a screenshot of the error.
pause
exit /b 1
