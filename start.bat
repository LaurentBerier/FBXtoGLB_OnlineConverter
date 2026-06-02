@echo off
REM ===========================================================================
REM  FBX <-> GLB Converter - local dev launcher
REM  Starts the API (:4000) and the web UI (:3000) together.
REM  Does NOT open a browser - open http://localhost:3000 yourself.
REM ===========================================================================
setlocal
cd /d "%~dp0"

REM Next.js dev never auto-opens a browser, so nothing to disable here.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH. Install Node 20+ and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [setup] Installing dependencies ^(first run^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo ===========================================================
echo   Starting servers...
echo     Web UI : http://localhost:3000   ^<-- open this manually
echo     API    : http://localhost:4000/api/health
echo.
echo   Press Ctrl+C to stop both servers.
echo ===========================================================
echo.

call npm run dev

endlocal
