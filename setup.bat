@echo off
REM ===========================================================================
REM  Sandscape · FBX <-> GLB Converter - Windows setup launcher
REM  Double-click this file to run the PowerShell setup with the right policy.
REM ===========================================================================
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
pause
endlocal
