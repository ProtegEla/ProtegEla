# Módulo: Auth (Autenticação e Credenciais)

## 1. Escopo e Requisitos Associados
- **RF01**: Cadastro de conta, validação de unicidade de e-mail e cadastro inicial de contatos de emergência.
- **RF02**: Login utilizando e-mail e senha cadastrados.
- **RF04**: Acesso às funcionalidades essenciais sem login via identificador pseudo-anônimo (`X-Device-Id`).
- **RF16**: Recuperação básica de senha via e-mail.
- **RN08**: Validação de complexidade de senha (mínimo 8 caracteres, maiúscula, minúscula, dígito e símbolo especial).

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas FastAPI `/api/v1/auth/*` e esquemas Pydantic de entrada/saída.
- `service.py`: Regras de negócio, geração e verificação de tokens e orquestração de autenticação.
- `models.py`: Modelos SQLAlchemy para sessões ou tokens de recuperação de senha.

