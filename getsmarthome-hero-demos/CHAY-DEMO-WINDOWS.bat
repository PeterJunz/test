@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Dang khoi dong demo tai http://localhost:5173 ...
echo (Giu cua so nay mo trong luc xem. Dong cua so de tat.)
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
echo Khong tim thay Python hoac Node.js tren may.
echo Cai mot trong hai (mien phi): https://www.python.org/downloads/  hoac  https://nodejs.org/
echo roi chay lai file nay.
pause
