@echo off
REM Double-click this file to enable AEHD (Android Emulator hypervisor driver).
REM It will prompt for Administrator (UAC), then run enable-aehd.ps1.
REM See enable-aehd.ps1 for what it does and how to revert.

setlocal
set "PS1=%~dp0enable-aehd.ps1"

if not exist "%PS1%" (
    echo [x] enable-aehd.ps1 not found next to this file.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%PS1%')"

echo.
echo A new Administrator window should have opened.
echo Finish the steps there, then restart Windows.
timeout /t 6 >nul
