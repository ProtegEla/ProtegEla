# Guia de Desenvolvimento Colaborativo e Contribuição

Este guia estabelece os padrões e convenções para que múltiplos integrantes do time possam trabalhar em paralelo no repositório **ProtegEla** com fluidez e o mínimo de atrito.

---

## 1. Convenções de Código e Nomenclatura

### 1.1. Back-end (Python / FastAPI)
- **Pastas e Arquivos**: sempre em `snake_case` (ex: `risk_zones/`, `calculate_route.py`).
- **Classes**: `PascalCase` (ex: `RiskZoneEntity`, `ReportRepository`).
- **Funções, Métodos e Variáveis**: `snake_case` (ex: `calculate_risk_score()`, `user_id`).
- **Constantes**: `UPPER_SNAKE_CASE` (ex: `MAX_EMERGENCY_CONTACTS = 3`).
- **Tipagem**: Uso obrigatório de *type hints* em todos os parâmetros e retornos de funções.

### 1.2. Front-end (React Native / TypeScript)
- **Componentes e Telas**: `PascalCase` (ex: `PanicButton.tsx`, `RiskModal.tsx`).
- **Arquivos de Utilidades, Hooks e Serviços**: `camelCase` (ex: `useUserLocation.ts`, `apiClient.ts`).
- **Pastas de Features**: `snake_case` ou `kebab-case` minúsculo (ex: `risk_zones/`, `emergency/`).
- **Tipos e Interfaces**: `PascalCase` (ex: `Report`, `SafeRouteResponse`).

---

## 2. Regras de Importação e Dependência entre Camadas

Para manter o acoplamento baixo e facilitar testes isolados:

1. **Camada de Domínio (`domain/`)**:
   - É o núcleo puro do negócio.
   - **PROIBIDO**: Importar FastAPI, SQLAlchemy, bibliotecas de terceiros de I/O ou camadas externas (`application`, `infrastructure`, `api`).
2. **Camada de Aplicação (`application/`)**:
   - Orquestra os casos de uso.
   - Pode importar `domain/`.
   - **PROIBIDO**: Importar detalhes de apresentação HTTP (`fastapi.Request`, etc.).
3. **Camada de Infraestrutura (`infrastructure/`)**:
   - Implementa repositórios e conexões externas.
   - Pode importar interfaces de `domain/` e tipos de `application/`.
4. **Camada de API (`api/`)**:
   - Recebe requisições HTTP e delega aos casos de uso.
   - Importa `application/` e esquemas Pydantic.

---

## 3. Fluxo de Git e Ramificações (Branches)

Adotamos o fluxo baseado em branches curtas integradas via Pull Request:

### 3.1. Nomes de Branches
- Funcionalidades: `feat/nome-curto-da-tarefa` (ex: `feat/panic-button-action`)
- Correções de bugs: `fix/descricao-do-problema` (ex: `fix/osm-timeout-handling`)
- Documentação: `docs/nome-do-assunto` (ex: `docs/api-contracts-update`)
- Refatoração: `refactor/modulo-alvo` (ex: `refactor/auth-domain-rules`)

### 3.2. Padrão de Commits (Conventional Commits)
Mensagens de commit devem seguir o formato `<tipo>: <descrição sucinta em minúsculas>`:
- `feat: adiciona calculo de agrupamento de risco de 20 metros`
- `fix: trata timeout gracioso da api do openrouteservice`
- `docs: detalha fluxo de criptografia de contatos de emergencia`
- `test: adiciona testes unitarios para RN08 de validacao de senha`
- `refactor: desacopla cliente http de infraestrutura do caso de uso`

---

## 4. Definition of Done (DoD) - Critérios de Conclusão

Uma tarefa ou Pull Request só é considerada concluída quando:

- [ ] O código implementa estritamente o requisito sem introduzir recursos não aprovados.
- [ ] A arquitetura em camadas foi respeitada sem vazamento de responsabilidades.
- [ ] Testes automatizados (unitários e/ou integração) foram escritos e passam com sucesso.
- [ ] Nenhum segredo, senha ou chave de API foi commitado no Git.
- [ ] Se houve alteração no banco de dados, o arquivo de migração do Alembic foi gerado e testado.
- [ ] Se houve alteração em endpoint, o documento `docs/api_contracts.md` foi atualizado.
- [ ] O Pull Request foi revisado e aprovado por pelo menos um colega de equipe.

---

## 5. Procedimento para Migrações de Banco de Dados (Alembic)

Para evitar conflitos de schema de banco entre desenvolvedores:
1. Altere o modelo do SQLAlchemy dentro da camada de infraestrutura do respectivo módulo.
2. Gere a migração com mensagem descritiva:
   ```bash
   cd backend
   alembic revision --autogenerate -m "create_reports_and_confirmations_tables"
   ```
3. Inspecione o arquivo gerado em `backend/alembic/versions/` para garantir que apenas as alterações desejadas foram capturadas.
4. Aplique a migração localmente:
   ```bash
   alembic upgrade head
   ```
5. Comite o arquivo de versão gerado junto com o PR da funcionalidade.

---

## 6. Organização e Prevenção de Conflitos no Time

1. **Gestão Visual no GitHub Projects**:
   - Cada funcionalidade do Backlog deve possuir uma Issue associada.
   - Mova o cartão da Issue para "In Progress" antes de iniciar a branch.
2. **Desenvolvimento Modular Paralelo**:
   - Integrantes devem atuar em módulos distintos do back-end (ex: um em `emergency`, outro em `reports`).
   - O núcleo compartilhado (`core/`) só deve ser alterado mediante alinhamento prévio no time.
3. **Sincronização Contínua**:
   - Atualize sua branch diariamente com a `main` para resolver divergências cedo:
     ```bash
     git fetch origin
     git rebase origin/main
     ```
