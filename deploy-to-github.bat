@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo   KaleidoSync - One-Click GitHub Deploy
echo ==================================================

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH.
    pause
    exit /b 1
)

if not exist ".git" (
    echo Initializing git repository...
    git init
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    git remote add origin https://github.com/dev-raman05/audio-video-engine.git
) else (
    git remote set-url origin https://github.com/dev-raman05/audio-video-engine.git
)

git branch -M main

set "AUTO_MODE=0"
if "%~1"=="--auto" set "AUTO_MODE=1"

if "%AUTO_MODE%"=="1" (
    set "COMMIT_MSG=Update KaleidoSync (%DATE% %TIME%)"
) else (
    set /p "COMMIT_MSG=Enter commit message (press Enter for automatic timestamp): "
    if "!COMMIT_MSG!"=="" (
        set "COMMIT_MSG=Update KaleidoSync (%DATE% %TIME%)"
    )
)

echo Staging changes...
git add -A

git diff --cached --quiet
if errorlevel 1 (
    echo Committing: !COMMIT_MSG!
    git commit -m "!COMMIT_MSG!"
) else (
    echo No new local changes to commit.
)

echo Syncing with origin/main...
git pull --rebase --autostash origin main 2>nul

echo Pushing to https://github.com/dev-raman05/audio-video-engine.git ...
git push -u origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Git push failed. Check your internet connection or GitHub login.
    if "%AUTO_MODE%"=="0" pause
    exit /b 1
)

echo.
echo [SUCCESS] Deployed to https://github.com/dev-raman05/audio-video-engine
if "%AUTO_MODE%"=="0" pause
exit /b 0
