# Módulo: Users (Perfil e Contatos de Emergência)

## 1. Escopo e Requisitos Associados
- **RF01**: Cadastro de até 3 contatos de emergência (1 principal e até 2 secundários).
- **RF17**: Atualização de dados cadastrais, contatos e preferências.
- **RNF06**: Criptografia em repouso dos contatos de emergência e e-mails pessoais no PostgreSQL (LGPD).
- **RNF07**: Garantia de não persistência de localização em tempo real no perfil.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/users/*` e esquemas Pydantic de perfil.
- `service.py`: Casos de uso de perfil, limites de contatos e lógica de exclusão LGPD.
- `models.py`: Modelos SQLAlchemy para usuárias e contatos de emergência.
