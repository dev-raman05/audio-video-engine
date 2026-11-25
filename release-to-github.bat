@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo   KaleidoSync - One-Click GitHub Release Trigger
echo ==================================================

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH.
    pause
    exit /b 1
)

set "VER=%~1"
if "%VER%"=="" (
    set /p "VER=Enter release version (e.g. 1.0.1): "
)
if "%VER%"=="" (
    echo [ERROR] Version cannot be empty.
    pause
    exit /b 1
)

if /I "%VER:~0,1%"=="v" set "VER=%VER:~1%"

echo Setting package version to %VER%...
call npm.cmd version %VER% --no-git-tag-version --allow-same-version
if errorlevel 1 (
    echo [ERROR] npm version update failed.
    pause
    exit /b 1
)

git branch -M main

echo Staging changes...
git add -A

git diff --cached --quiet
if errorlevel 1 (
    echo Committing Release v%VER%...
    git commit -m "Release v%VER%"
) else (
    echo No new file changes to commit; tagging current HEAD.
)

echo Creating/updating tag v%VER%...
git tag -f v%VER%

echo Pushing main branch and tag v%VER% to origin...
git push -u origin main
if errorlevel 1 (
    echo [ERROR] Failed to push main branch.
    pause
    exit /b 1
)

git push -f origin v%VER%
if errorlevel 1 (
    echo [ERROR] Failed to push tag v%VER%.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Release v%VER% triggered on GitHub!
echo   Actions build status: https://github.com/dev-raman05/audio-video-engine/actions
echo   Releases page:        https://github.com/dev-raman05/audio-video-engine/releases
if "%~1"=="" pause
exit /b 0
