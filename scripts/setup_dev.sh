#!/usr/bin/env bash
# ==============================================================================
# ProtegEla - Script de Setup do Ambiente de Desenvolvimento (Linux / macOS)
# ==============================================================================

set -e

echo "=== [1/3] Configurando arquivos de ambiente (.env) ==="
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Criado .env a partir de .env.example"
fi

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "Criado backend/.env"
fi

if [ ! -f "apps/mobile/.env" ]; then
    cp apps/mobile/.env.example apps/mobile/.env
    echo "Criado apps/mobile/.env"
fi

echo "=== [2/3] Banco de Dados Local (PostgreSQL) ==="
echo "Certifique-se de que o PostgreSQL está rodando localmente na porta 5432."
echo "Para criar o banco e habilitar o PostGIS via psql:"
echo "  CREATE USER protegela_user WITH PASSWORD 'protegela_secret_dev_pass';"
echo "  CREATE DATABASE protegela_db OWNER protegela_user;"
echo "  \\c protegela_db"
echo "  CREATE EXTENSION IF NOT EXISTS postgis;"

echo "=== [3/3] Instruções de Execução ==="
echo "Back-end (FastAPI):"
echo "  cd backend"
echo "  python3 -m venv venv"
echo "  source venv/bin/activate"
echo "  pip install -r requirements-dev.txt"
echo "  uvicorn src.main:app --reload"
echo ""
echo "Front-end Mobile (Expo):"
echo "  cd apps/mobile"
echo "  npm install"
echo "  npx expo start"

echo "=== Setup Inicial Concluído! ==="
