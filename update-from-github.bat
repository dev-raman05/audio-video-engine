@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo   KaleidoSync - One-Click Update from GitHub
echo ==================================================

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH.
    pause
    exit /b 1
)

echo Pulling latest updates from origin/main...
git pull --rebase --autostash origin main
if errorlevel 1 (
    echo [ERROR] Failed to pull updates from GitHub.
    pause
    exit /b 1
)

echo Installing/updating dependencies...
call npm.cmd install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo Rebuilding standalone KaleidoSync app...
call npm.cmd run dist
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] KaleidoSync updated and rebuilt at dist\win-unpacked\KaleidoSync.exe
pause
exit /b 0
