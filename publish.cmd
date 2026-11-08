@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1" %*
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo 发布流程失败，请查看上面的提示。
) else (
  echo 发布流程结束。
)
echo.
pause
exit /b %EXITCODE%
