@echo off
cd /d "%~dp0"

echo ================================
echo   my_silly - Quick Start
echo ================================
echo.

if not exist "node_modules\" (
    echo [1/2] First run, installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Dependency install failed. Check that Node.js is installed.
        pause
        exit /b 1
    )
    echo.
) else (
    echo [1/2] Dependencies ready, skip install.
)

echo [2/2] Starting Vite dev server...
echo.
call npm run dev

pause
