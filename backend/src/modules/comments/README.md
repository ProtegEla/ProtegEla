# Módulo: Comments (Comentários e Respostas Comunitárias)

## 1. Escopo e Requisitos Associados
- **RF07**: Exibição dos comentários em modal ao detalhar um relato ou zona de risco.
- **RF08**: Leitura, adição, edição e exclusão de comentários próprios e respostas em escadinha.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/comments/*` e esquemas Pydantic.
- `service.py`: Lógica de hierarquia de comentários e validação de permissões de autor.
- `models.py`: Modelos SQLAlchemy para comentários e autorreferência para respostas.
