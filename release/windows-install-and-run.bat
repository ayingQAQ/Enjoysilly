@echo off
chcp 65001 >nul
setlocal EnableExtensions

title Enjoy Silly - Install and Run

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

echo.
echo ============================================================
echo  Enjoy Silly - 本地安装并启动
echo ============================================================
echo.
echo 当前目录:
echo %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Node.js。
  echo.
  echo 请先安装 Node.js LTS 版本:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 npm。
  echo.
  echo 请确认 Node.js 已正确安装，并重新打开此脚本。
  echo.
  pause
  exit /b 1
)

echo Node 版本:
node --version
echo npm 版本:
npm --version
echo.

echo [1/2] 正在安装 / 更新依赖...
call npm install
if errorlevel 1 (
  echo.
  echo [错误] 依赖安装失败。
  echo 请检查网络、npm 源或 package-lock.json 是否完整。
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] 正在启动 Enjoy Silly...
echo.
echo 如果浏览器没有自动打开，请手动访问:
echo http://127.0.0.1:5173/
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:5173/'"

call npm run dev -- --host 127.0.0.1 --port 5173

echo.
echo 服务已停止。
pause
