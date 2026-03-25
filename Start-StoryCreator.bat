@echo off
setlocal

cd /d "%~dp0"

set "NPM_CMD=npm"
set "NODE_DIR=C:\Program Files\nodejs"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"
if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

if not exist "node_modules\electron" (
  echo Installing dependencies first...
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo.
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

call "%NPM_CMD%" start

if errorlevel 1 (
  echo.
  echo Story Forge failed to start.
  pause
  exit /b 1
)
