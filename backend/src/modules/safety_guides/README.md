# Módulo: Safety Guides (Orientações e Dicas de Segurança)

## 1. Escopo e Requisitos Associados
- **RF11**: Exibição de orientações e dicas de segurança em textos educativos em tópicos.
- Leitura pública, sem login (RF04). Conteúdo mantido por migrações do Alembic.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas públicas `/api/v1/safety-guides` e `/api/v1/safety-guides/{slug}`.
- `schemas.py`: Contratos HTTP de resumo e detalhe.
- `service.py`: Consulta ordenada e busca por slug.
- `models.py`: Modelo SQLAlchemy da tabela `safety_guides`.