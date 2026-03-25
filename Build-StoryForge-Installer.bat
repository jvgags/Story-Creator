@echo off
setlocal

cd /d "%~dp0"

set "NPM_CMD=npm"
set "NODE_DIR=C:\Program Files\nodejs"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"
if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

echo Installing dependencies...
call "%NPM_CMD%" install
if errorlevel 1 (
  echo.
  echo Failed to install dependencies.
  pause
  exit /b 1
)

echo.
echo Building Story Forge installer and portable app...
call "%NPM_CMD%" run build:win
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete. Check the "dist" folder.
pause
