@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting Little Linden hero lab at http://localhost:5173 ...
echo (Keep this window open while viewing. Close it to stop.)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:5173/
  python -m http.server 5173
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:5173/
  py -m http.server 5173
  goto :eof
)
where npx >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:5173/
  npx --yes http-server . -p 5173 -c-1
  goto :eof
)
echo.
echo Python or Node.js was not found.
echo Install one of them (free): https://www.python.org/downloads/ or https://nodejs.org/
echo then run this file again.
pause
