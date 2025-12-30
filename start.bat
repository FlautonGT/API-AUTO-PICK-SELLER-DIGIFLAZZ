@echo off
title Digiflazz Picker v5.0
color 0A

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║         DIGIFLAZZ API SELLER PICKER v5.0                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Download dari: https://nodejs.org/
    pause
    exit /b 1
)

:: Check node_modules
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    npm install
    echo.
)

:: Check .env
if not exist ".env" (
    echo [WARNING] File .env tidak ditemukan!
    if exist ".env.example" (
        copy .env.example .env
        echo [INFO] Created .env from .env.example
        echo [INFO] Please edit .env with your tokens!
        notepad .env
        pause
        exit /b 1
    )
)

echo [INFO] Starting...
echo.

node index.js %*

echo.
echo [INFO] Finished!
pause