#!/usr/bin/env python3
"""
Script de verificação da integridade arquitetural do repositório ProtegEla.
Não requer bibliotecas de terceiros (usa apenas a biblioteca padrão do Python).
"""

from pathlib import Path
import sys

REQUIRED_DIRECTORIES = [
    "apps/mobile",
    "apps/mobile/app",
    "apps/mobile/src/components",
    "apps/mobile/src/features",
    "apps/mobile/src/services",
    "apps/mobile/src/storage",
    "apps/mobile/src/theme",
    "apps/mobile/src/types",
    "backend",
    "backend/alembic",
    "backend/alembic/versions",
    "backend/src/core",
    "backend/src/api/v1",
    "backend/src/modules",
    "backend/tests/unit",
    "backend/tests/integration",
    "docs",
    "scripts",
    ".github/ISSUE_TEMPLATE",
]

BACKEND_MODULES = [
    "auth",
    "users",
    "reports",
    "comments",
    "risk_zones",
    "routes",
    "emergency",
    "support_locations",
    "notifications",
]

REQUIRED_FILES = [
    ".gitignore",
    ".env.example",
    "AGENTS.md",
    "README.md",
    "docs/architecture.md",
    "docs/api_contracts.md",
    "docs/security_and_privacy.md",
    "docs/local_setup.md",
    "docs/contributing.md",
    ".github/pull_request_template.md",
    "backend/requirements.txt",
    "backend/requirements-dev.txt",
    "backend/alembic.ini",
    "backend/src/main.py",
    "backend/src/core/config.py",
    "backend/src/core/database.py",
    "backend/src/core/exceptions.py",
    "backend/src/core/security.py",
    "backend/src/api/v1/api_router.py",
    "apps/mobile/package.json",
    "apps/mobile/app.json",
    "apps/mobile/tsconfig.json",
    "apps/mobile/app/_layout.tsx",
    "apps/mobile/app/index.tsx",
    "apps/mobile/src/services/api/client.ts",
    "apps/mobile/src/storage/secureStore.ts",
    "apps/mobile/src/storage/localStorage.ts",
]


def verify() -> bool:
    root = Path(__file__).resolve().parent.parent
    errors = []

    print(f"[*] Verificando integridade do repositório em: {root}")

    # 1. Verificar diretórios obrigatórios
    for rel_dir in REQUIRED_DIRECTORIES:
        target = root / rel_dir
        if not target.is_dir():
            errors.append(f"Diretório ausente: {rel_dir}")

    # 2. Verificar os 9 módulos do backend e seus arquivos diretos
    for mod in BACKEND_MODULES:
        mod_dir = root / "backend" / "src" / "modules" / mod
        if not mod_dir.is_dir():
            errors.append(f"Módulo backend ausente: backend/src/modules/{mod}")
            continue

        for required_mod_file in ["router.py", "service.py", "models.py", "README.md"]:
            target_file = mod_dir / required_mod_file
            if not target_file.is_file():
                errors.append(f"Arquivo ausente no módulo: backend/src/modules/{mod}/{required_mod_file}")

    # 3. Verificar arquivos essenciais
    for rel_file in REQUIRED_FILES:
        target = root / rel_file
        if not target.is_file():
            errors.append(f"Arquivo ausente: {rel_file}")

    if errors:
        print("\n[!] Foram encontrados erros na estrutura arquitetural:")
        for err in errors:
            print(f"  - {err}")
        return False

    print("\n[+] Todos os diretórios, módulos e arquivos essenciais foram validados com SUCESSO!")
    return True


if __name__ == "__main__":
    success = verify()
    sys.exit(0 if success else 1)
