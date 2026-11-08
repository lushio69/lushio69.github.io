@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\new-post.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo 创建失败。
) else (
  echo 可以运行 dev.cmd 预览，完成后运行 publish.cmd 发布。
)
echo.
pause
exit /b %EXITCODE%
