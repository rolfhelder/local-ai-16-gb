@echo off
if /I "%~1"=="install" (
  powershell.exe -NoProfile -File "%~dp0..\scripts\install-command.ps1" %*
  exit /b
)
"%~dp0..\runtime\node\node.exe" "%~dp0..\scripts\pia.mjs" %*
