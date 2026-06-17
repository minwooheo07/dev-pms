@echo off
chcp 65001 > nul
echo ========================================
echo  L.PMS Start
echo ========================================
echo.

echo [1/2] Starting Backend...
start "PMS Backend" cmd /k "cd /d "%~dp0backend" && npm run start:dev"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend...
start "PMS Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Servers starting...
echo   Backend:  http://localhost:3000/api
echo   Frontend: http://localhost:5173
echo.
pause
