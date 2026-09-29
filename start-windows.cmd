@echo off
rem Double-click this file to start Bracket Club on Windows.
rem Keep the window open while you use the site; close it to stop.
title Bracket Club
cd /d "%~dp0"
where npm >/dev/null 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Get the LTS version from https://nodejs.org
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)
echo.
echo   Starting Bracket Club. Your browser will open http://localhost:5173
echo   Keep this window open while you use the site. Close it to stop.
echo.
call npm run dev
pause
