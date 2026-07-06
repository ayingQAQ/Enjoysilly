@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ================================
echo   my_silly — 一键启动
echo ================================
echo.

if not exist "node_modules\" (
    echo [1/2] 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，请检查 Node.js 是否已安装。
        pause
        exit /b 1
    )
    echo.
) else (
    echo [1/2] 依赖已就绪，跳过安装。
)

echo [2/2] 启动 Vite 开发服务器...
echo.
call npm run dev

pause
