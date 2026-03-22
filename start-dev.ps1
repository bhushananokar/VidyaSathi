# VidyaSathi Development Starter for Windows (PowerShell)
# Usage: .\start-dev.ps1

Write-Host "🌟 Starting VidyaSathi Development Environment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Check .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env not found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "📝 Please fill in GEMINI_API_KEY and GROQ_API_KEY in .env" -ForegroundColor Yellow
}

# Load .env
Get-Content ".env" | Where-Object { $_ -notmatch "^#" -and $_ -match "=" } | ForEach-Object {
    $parts = $_ -split "=", 2
    [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
}

# Backend
Write-Host "`n🐍 Starting FastAPI backend..." -ForegroundColor Green
Set-Location backend

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Gray
    python -m venv venv
}

& venv\Scripts\python.exe -m pip install -r requirements.txt -q

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
}

$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    & venv\Scripts\uvicorn.exe main:app --reload --port 8000
}

Write-Host "✅ Backend starting at http://localhost:8000" -ForegroundColor Green
Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor Gray

Set-Location ..

# Frontend
Write-Host "`n⚛️  Starting React frontend..." -ForegroundColor Green
Set-Location frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies (first time, ~2 minutes)..." -ForegroundColor Gray
    npm install
}

$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev
}

Set-Location ..

Write-Host "`n🚀 VidyaSathi is starting up!" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "`nPress Ctrl+C to stop." -ForegroundColor Gray

# Stream output from both jobs
try {
    while ($true) {
        Receive-Job $backendJob
        Receive-Job $frontendJob
        Start-Sleep 1
    }
} finally {
    Stop-Job $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob -Force
}
