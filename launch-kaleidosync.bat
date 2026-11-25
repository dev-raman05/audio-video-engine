@echo off
cd /d "%~dp0"

if exist "dist\win-unpacked\KaleidoSync.exe" (
    start "" "dist\win-unpacked\KaleidoSync.exe"
) else (
    call npm.cmd start
)
