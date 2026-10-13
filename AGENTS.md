# Regras Operacionais para Agentes de Inteligência Artificial (AI Agents)

Este arquivo define as diretrizes estritas e mandatórias para qualquer agente de IA (como Antigravity, GitHub Copilot Workspace, Cursor, Claude Code, etc.) atuando no repositório **ProtegEla**.

---

## 1. Leitura Prévia Obrigatória
Antes de propor, criar ou alterar qualquer linha de código ou configuração:
1. Leia o arquivo [docs/architecture.md](file:///docs/architecture.md) para compreender a organização dos módulos.
2. Leia o arquivo [docs/api_contracts.md](file:///docs/api_contracts.md) para verificar contratos e padrões de comunicação.
3. Leia o arquivo [docs/security_and_privacy.md](file:///docs/security_and_privacy.md) para garantir conformidade de segurança e LGPD.
4. Consulte os requisitos do produto em [doc_inicial.md](file:///doc_inicial.md) para verificar se a funcionalidade solicitada está no escopo aprovado.

---

## 2. Respeito às Fronteiras Arquiteturais
- **Backend (FastAPI)**:
  - Respeite a estrutura direta modular em `backend/src/modules/<nome>/`:
    - `router.py`: Apenas roteamento HTTP, validação de schema (Pydantic), injeção de dependências e códigos de status.
    - `service.py`: Casos de uso, orquestração e regras de negócio puras.
    - `models.py`: Modelos de banco de dados do SQLAlchemy herdados de `Base`.
  - Não realize chamadas diretas de banco de dados nem consultas SQL dentro do `router.py`; delegue para o `service.py` ou repositórios específicos quando existirem.
- **Frontend (Expo / React Native)**:
  - Nunca realize chamadas HTTP diretas (Fetch/Axios) dentro dos componentes de tela. Use a camada de serviços em `src/services/api/` e custom hooks.
  - Isole a lógica de estado de negócio nos módulos em `src/features/`.
  - Mantenha componentes de UI puramente visuais e reutilizáveis em `src/components/ui/`.

---

## 3. Escopo Mínimo de Modificação
- Modifique **somente** os arquivos estritamente necessários para cumprir a tarefa solicitada.
- Não reformate arquivos inteiros nem altere estilo de código não relacionado.
- Não crie arquivos ou abstrações prematuras ou "código morto" sem utilidade justificada.
- **Não altere o README principal em hipótese alguma.**

---

## 4. Gestão de Dependências e Ambiente
- **É proibido adicionar pacotes ou dependências externas** sem apresentar justificativa técnica clara e solicitar aprovação da equipe.
- **O projeto não utiliza Docker**. Utilize PostgreSQL e ferramentas instaladas localmente.

---

## 5. Contratos de API e Banco de Dados
- Não altere contratos compartilhados (rotas, payloads JSON, query params, headers) sem registrar a alteração no documento [docs/api_contracts.md](file:///docs/api_contracts.md).
- Qualquer alteração em tabelas ou colunas do banco de dados deve ser obrigatoriamente acompanhada de uma migração do Alembic em `backend/alembic/versions/`.

---

## 6. Qualidade e Testes Automatizados
- Toda nova funcionalidade ou correção de bug deve vir acompanhada dos respectivos testes:
  - Backend: testes unitários para regras de negócio em `service.py` e testes de integração para endpoints da API.
  - Frontend: testes unitários para hooks, serviços e componentes críticos.
- Não marque uma tarefa como pronta se houver testes falhando.

---

## 7. Transparência e Rastreabilidade
Ao concluir cada iteração ou resposta, o agente deve:
1. Listar os arquivos criados, modificados ou excluídos com links no formato Markdown.
2. Resumir sucintamente as decisões arquiteturais adotadas.
3. Apontar eventuais limitações técnicas, premissas assumidas ou pontos que dependem de validação humana.

---

## 8. Fidelidade aos Requisitos
- **Não invente funcionalidades** que não estejam descritas no Product Backlog de [doc_inicial.md](file:///doc_inicial.md).
- Em tarefas de infraestrutura ou estruturação, não implemente a lógica de negócio dos casos de uso finais a menos que explicitamente solicitado pelo usuário.
