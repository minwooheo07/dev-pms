# L.PMS Start Script
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting L.PMS..." -ForegroundColor Cyan

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run start:dev"

Start-Sleep -Seconds 3

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Servers starting in separate windows." -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3000/api"
Write-Host "  Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Open http://localhost:5173 in your browser."
