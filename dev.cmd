@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  正在启动本地预览...
echo  按 Ctrl+C 停止服务器。
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$node = Get-Command node -ErrorAction SilentlyContinue; if (-not $node) { $candidate = Join-Path $env:ProgramFiles 'nodejs\node.exe'; if (Test-Path $candidate) { & $candidate 'scripts\dev.mjs' } else { Write-Host '没有找到 Node.js，请先安装 Node.js 18+。' -ForegroundColor Red; exit 1 } } else { & $node.Source 'scripts\dev.mjs' }"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" pause
exit /b %EXITCODE%
