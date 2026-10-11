@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Dang khoi dong demo... (giu cua so nay mo trong luc xem)
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
echo Khong tim thay Python hoac Node.js. Cai mot trong hai (mien phi) roi chay lai:
echo https://www.python.org/downloads/  /  https://nodejs.org/
:end
pause
