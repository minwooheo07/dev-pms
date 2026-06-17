@echo off
chcp 65001 > nul
echo ========================================
echo  L.PMS Setup
echo ========================================
echo.
echo PostgreSQL must be running.
echo DB: pms_db / User: postgres / PW: postgres
echo.

echo [1/3] Running DB migration...
cd /d "%~dp0backend"
call npx prisma migrate dev --name init
if errorlevel 1 (
    echo ERROR: Migration failed. Check your DATABASE_URL in backend\.env
    pause
    exit /b 1
)

echo.
echo [2/3] Backend dependencies OK
call npm install

echo.
echo [3/3] Frontend dependencies OK
cd /d "%~dp0frontend"
call npm install

echo.
echo Setup complete! Run start.bat to launch.
pause
