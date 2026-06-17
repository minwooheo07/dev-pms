# L.PMS Setup Script
Write-Host "========================================"
Write-Host "  L.PMS - Setup"
Write-Host "========================================"
Write-Host ""
Write-Host "PostgreSQL must be running."
Write-Host "DB: pms_db / User: postgres / PW: postgres"
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. DB Migration
Write-Host "[1/3] Running DB migration..."
Set-Location "$root\backend"
npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Migration failed. Check backend\.env DATABASE_URL" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# 2. Backend deps
Write-Host ""
Write-Host "[2/3] Backend dependencies..."
npm install

# 3. Frontend deps
Write-Host ""
Write-Host "[3/3] Frontend dependencies..."
Set-Location "$root\frontend"
npm install

Write-Host ""
Write-Host "Setup complete! Run start.ps1 to launch." -ForegroundColor Green
Read-Host "Press Enter to exit"
