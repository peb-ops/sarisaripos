@echo off
title Sari-Sari POS
if not exist "%~dp0system\install.ps1" (
  echo.
  echo  Please extract the zip file first.
  echo  Right-click the zip file, choose "Extract All...", then open the
  echo  extracted folder and double-click "Install Sari-Sari POS" again.
  echo.
  echo  I-extract muna ang zip file: i-right-click, piliin ang "Extract All...",
  echo  tapos i-double-click ulit ang "Install Sari-Sari POS" sa bagong folder.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0system\install.ps1"
