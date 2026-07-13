@echo off
setlocal EnableExtensions DisableDelayedExpansion

call "%~dp0..\setup-and-start.bat"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
