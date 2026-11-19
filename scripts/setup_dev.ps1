# ==============================================================================
# ProtegEla - Script de Setup do Ambiente de Desenvolvimento (Windows PowerShell)
# ==============================================================================

Write-Host "=== [1/3] Configurando arquivos de ambiente (.env) ===" -ForegroundColor Cyan
if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Criado .env raiz a partir de .env.example" -ForegroundColor Green
}

if (!(Test-Path "backend/.env")) {
    Copy-Item "backend/.env.example" "backend/.env"
    Write-Host "Criado backend/.env" -ForegroundColor Green
}

if (!(Test-Path "apps/mobile/.env")) {
    Copy-Item "apps/mobile/.env.example" "apps/mobile/.env"
    Write-Host "Criado apps/mobile/.env" -ForegroundColor Green
}

Write-Host "`n=== [2/3] Banco de Dados Local (PostgreSQL) ===" -ForegroundColor Cyan
Write-Host "Certifique-se de que o PostgreSQL está instalado e ativo na porta 5432."
Write-Host "Comandos SQL recomendados no psql ou pgAdmin:" -ForegroundColor Yellow
Write-Host "  CREATE USER protegela_user WITH PASSWORD 'protegela_secret_dev_pass';"
Write-Host "  CREATE DATABASE protegela_db OWNER protegela_user;"
Write-Host "  \c protegela_db"
Write-Host "  CREATE EXTENSION IF NOT EXISTS postgis;"

Write-Host "`n=== [3/3] Instruções de Execução ===" -ForegroundColor Cyan
Write-Host "Back-end (FastAPI):"
Write-Host "  cd backend"
Write-Host "  python -m venv venv"
Write-Host "  .\venv\Scripts\Activate.ps1"
Write-Host "  pip install -r requirements-dev.txt"
Write-Host "  uvicorn src.main:app --reload"

Write-Host "`nFront-end Mobile (Expo):"
Write-Host "  cd apps/mobile"
Write-Host "  npm install"
Write-Host "  npx expo start"

Write-Host "`nSetup Inicial Concluido!" -ForegroundColor Green
