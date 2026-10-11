@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting Little Linden hero lab... (keep this window open while viewing)
python -c "import sys" >nul 2>nul
if %errorlevel%==0 (
  python serve.py
  goto :end
)
py -3 -c "import sys" >nul 2>nul
if %errorlevel%==0 (
  py -3 serve.py
  goto :end
)
where npx >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 4 >nul & start http://localhost:5173/"
  npx --yes http-server . -p 5173 -c-1
  goto :end
)
echo.
echo Python or Node.js not found. Install one (free), then run this file again:
echo https://www.python.org/downloads/  /  https://nodejs.org/
:end
pause
