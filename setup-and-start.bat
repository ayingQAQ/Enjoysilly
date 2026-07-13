@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "MODE=%~1"
if "%MODE%"=="" set "MODE=run"
if /I "%MODE%"=="--open-browser" goto open_browser
if /I not "%MODE%"=="run" if /I not "%MODE%"=="--check" goto usage

set "PROJECT_ROOT=%~dp0"
pushd "%PROJECT_ROOT%" >nul 2>&1
if errorlevel 1 goto project_error
set "PUSHD_DONE=1"

if not exist "package.json" goto project_error
if not exist "package-lock.json" goto lockfile_error

if /I "%MODE%"=="--check" goto check_environment

:check_environment
where node >nul 2>&1
if errorlevel 1 goto node_missing

where npm >nul 2>&1
if errorlevel 1 goto npm_missing

set "NODE_MAJOR="
for /f "tokens=1 delims=." %%A in ('node -p "process.versions.node" 2^>nul') do set "NODE_MAJOR=%%A"
if not defined NODE_MAJOR goto node_version_error
if %NODE_MAJOR% LSS 20 goto node_version_error

echo Node.js version:
node --version
echo npm version:
npm --version

if /I "%MODE%"=="--check" goto success

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if not errorlevel 1 goto port_in_use

echo.
echo Installing locked project dependencies...
call npm ci --ignore-scripts --no-audit --fund=false
if errorlevel 1 goto dependency_error

echo.
echo Starting Enjoy Silly on http://127.0.0.1:5173/
echo Close this window or press Ctrl+C to stop the local server.
start "" /b "%ComSpec%" /d /c call "%~f0" --open-browser
call npm run dev -- --host 127.0.0.1 --port 5173
set "EXIT_CODE=%ERRORLEVEL%"
popd
endlocal & exit /b %EXIT_CODE%

:success
echo Environment check passed.
if defined PUSHD_DONE popd >nul 2>&1
endlocal & exit /b 0

:usage
echo Usage: setup-and-start.bat [--check]
endlocal & exit /b 2

:open_browser
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173/"
endlocal & exit /b 0

:project_error
echo [ERROR] The project root or package.json could not be found.
goto fail

:lockfile_error
echo [ERROR] package-lock.json is required for a reproducible install.
goto fail

:node_missing
echo [ERROR] Node.js 20 or later was not found.
echo Install Node.js LTS from https://nodejs.org/ and run this script again.
goto fail

:npm_missing
echo [ERROR] npm was not found with the current Node.js installation.
goto fail

:node_version_error
echo [ERROR] Node.js 20 or later is required.
goto fail

:dependency_error
echo [ERROR] Dependency installation failed. Check your network and npm registry settings.
goto fail

:port_in_use
echo [ERROR] Port 5173 is already in use.
echo Close the existing local server before reinstalling dependencies, then run this script again.
goto fail

:fail
if defined PUSHD_DONE popd >nul 2>&1
echo.
pause
endlocal & exit /b 1
