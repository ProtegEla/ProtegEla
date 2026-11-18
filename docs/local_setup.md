# Guia de Preparação e Execução do Ambiente Local

Este documento reúne todas as orientações práticas para que os integrantes da equipe configurem e executem o projeto **ProtegEla** em suas máquinas locais, **sem dependência de Docker**.

---

## 1. Pré-requisitos de Instalação

Antes de começar, certifique-se de ter instalado em sua máquina:
- **Git**: controle de versão.
- **Python**: versão **3.11** ou superior (com `venv` e `pip`).
- **Node.js**: versão **18 LTS** ou **20 LTS** (com `npm`).
- **PostgreSQL**: versão **15** ou **16** instalado localmente com suporte à extensão **PostGIS** (pacote `postgis` instalado via instalador do PostgreSQL / StackBuilder no Windows ou gerenciador de pacotes no Linux/macOS).

---

## 2. Configuração do Ambiente e Variáveis

1. Clone o repositório em sua máquina:
   ```bash
   git clone https://github.com/mulack/ProtegEla.git
   cd ProtegEla
   ```
2. Inicialize os arquivos de variáveis de ambiente a partir dos modelos `.example`:
   - **Linux / macOS**:
     ```bash
     cp .env.example .env
     cp backend/.env.example backend/.env
     cp apps/mobile/.env.example apps/mobile/.env
     ```
   - **Windows PowerShell**:
     ```powershell
     Copy-Item .env.example .env
     Copy-Item backend/.env.example backend/.env
     Copy-Item apps/mobile/.env.example apps/mobile/.env
     ```
   *(Ou execute o script automatizado `scripts/setup_dev.sh` ou `scripts/setup_dev.ps1`).*

### Chaves do backend

Antes de iniciar o backend, preencha em `backend/.env`:

- `FIELD_ENCRYPTION_KEY`: cifra e-mails e telefones. Deve ser uma chave Fernet válida.
- `FIELD_LOOKUP_KEY`: segredo não vazio usado para buscar e-mails e identificar tentativas de login.
- `APP_SECRET_KEY`: assina os tokens JWT. Use um segredo próprio do ambiente.

Em um **ambiente novo**, com as dependências instaladas, gere uma chave Fernet:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Para criar os outros segredos, execute o comando abaixo uma vez para cada um:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copie cada resultado para o campo correspondente do seu arquivo privado. Não envie
esses valores ao Git nem os publique em issues, mensagens de erro ou capturas de tela.
Inicie o backend dentro de `backend/`, para que ele leia esse `.env`. Variáveis já
definidas no terminal têm prioridade sobre o arquivo.

**Se o ambiente já tem dados, conserve as chaves existentes.** Instâncias que usam
o mesmo banco precisam da mesma chave Fernet e de lookup. Guarde uma cópia segura
para reutilizar após reiniciar ou reinstalar a aplicação. Perder ou trocar a chave
Fernet impede a leitura dos campos cifrados com ela. Trocar a chave de lookup impede
encontrar os e-mails já cadastrados e afeta o controle de tentativas de login. Trocar
a chave JWT invalida os tokens anteriores; instâncias que aceitam os mesmos tokens
precisam usar a mesma configuração JWT.

O backend rejeita chaves de criptografia ausentes ou inválidas na inicialização.
Ele não gera substitutos nem converte dados existentes. Os exemplos não fornecem
as duas chaves obrigatórias preenchidas. Dados gravados pelo antigo fallback só
podem ser recuperados com a chave aleatória daquele processo, se ela ainda existir.

---

## 3. Configuração do Banco de Dados PostgreSQL Local

Cada integrante deve ter um servidor PostgreSQL rodando localmente (porta padrão `5432`).

### 3.1. Criação do Usuário e Banco de Dados
Acesse o terminal do `psql` ou utilize o **pgAdmin**:

```sql
-- Criar usuário com permissões locais
CREATE USER protegela_user WITH PASSWORD 'protegela_secret_dev_pass';

-- Criar o banco de dados pertencente ao usuário
CREATE DATABASE protegela_db OWNER protegela_user;

-- Conectar ao banco criado
\c protegela_db

-- Ativar a extensão geoespacial PostGIS (obrigatória para zonas de risco e delegacias)
CREATE EXTENSION IF NOT EXISTS postgis;
```

> [!TIP]
> Caso utilize outro usuário ou senha no seu PostgreSQL local, ajuste as variáveis `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` e `DATABASE_SYNC_URL` no arquivo `backend/.env`.

---

## 4. Migrações de Banco de Dados com Alembic

> [!NOTE]
> O modelo `Report` e a migração `0001_create_reports` já estão definidos. O ambiente Alembic registra o modelo e exclui tabelas internas das extensões espaciais da comparação automática. A migração requer PostGIS habilitado previamente. Aplicação, comparação com o modelo (`alembic check`), reversão e reaplicação foram verificadas no banco local `protegela_test`, com PostgreSQL 16 e PostGIS 3.6.

> A tabela de relatos ainda não possui chave estrangeira para a autora: essa integração depende do modelo real de usuárias e da política de exclusão de conta. Isso não autoriza cadastrar relatos sem autenticação nem representa uma entrega funcional do RF09.

### Como executar:
1. Dentro de `backend/`, com o ambiente virtual ativado:
2. **Gerar uma nova migração** automaticamente a partir das alterações nos modelos:
   ```bash
   alembic revision --autogenerate -m "descricao_da_migracao"
   ```
3. Inspecione o script gerado em `backend/alembic/versions/`.
4. **Aplicar a migração** no seu banco de dados local:
   ```bash
   alembic upgrade head
   ```
5. **Reverter a última migração** (se necessário desfazer):
   ```bash
   alembic downgrade -1
   ```

Para verificar a migração de relatos em um **banco separado de testes**, configure `DATABASE_URL` e `DATABASE_SYNC_URL` em `backend/.env` para esse banco, com PostGIS habilitado. Execute `alembic upgrade head`, `alembic check`, `alembic downgrade base` e novamente `alembic upgrade head`. A reversão remove a tabela e seus relatos; use apenas dados descartáveis nessa verificação. Não gere uma segunda migração para criar a mesma tabela. Se outra migração for integrada antes desta, revise a cadeia de revisões antes de aplicá-la.

Sem servidor disponível, `alembic upgrade head --sql` e `alembic downgrade 0001_create_reports:base --sql` permitem inspecionar o SQL gerado, mas não comprovam aplicação, reversão ou compatibilidade com o banco real.

---

## 5. Como Iniciar o Back-end (FastAPI)

1. Navegue até o diretório do backend:
   ```bash
   cd backend
   ```
2. Crie e ative o ambiente virtual:
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows PowerShell**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
3. Instale as dependências:
   ```bash
   pip install -r requirements-dev.txt
   ```
4. Inicie o servidor de desenvolvimento com reload automático:
   ```bash
   uvicorn src.main:app --reload --port 8000
   ```
5. O servidor estará disponível em `http://localhost:8000`.

---

## 6. Como Iniciar o Front-end Mobile (Expo)

1. Em outro terminal, navegue até o diretório do aplicativo:
   ```bash
   cd apps/mobile
   ```
2. Instale as dependências com o npm:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento do Expo:
   ```bash
   npx expo start
   ```
4. Opções de visualização:
   - Pressione **`a`** para abrir no emulador Android (requer Android Studio configurado).
   - Pressione **`w`** para abrir no navegador web via React Native Web.
   - Escaneie o QR Code no seu smartphone através do aplicativo **Expo Go**.

---

## 7. Como Verificar se Cada Parte Está Funcionando

### 7.1. Verificação do Back-end
- **Healthcheck Geral**: Acesse no navegador ou terminal:
  ```http
  GET http://localhost:8000/api/v1/health
  ```
  Resposta esperada: `{"status": "healthy", "service": "ProtegEla API", "version": "1.0.0"}`.
- **Documentação Interativa (Swagger UI)**:
  Acesse [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs) para inspecionar os endpoints montados de cada módulo.
- **Status dos Módulos**:
  Cada módulo possui rota de status, por exemplo: `http://localhost:8000/api/v1/auth/status`.

#### Teste local de recuperação de senha (RF16)

1. Com o PostgreSQL local ativo e o ambiente virtual ativado, rode `alembic upgrade head` na pasta `backend`.
2. Preencha as variáveis `SMTP_*` no `backend/.env` usando o [arquivo de exemplo](../backend/.env.example). Se usar o Gmail do projeto, defina `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587` e `SMTP_STARTTLS=true`. Use o Gmail do projeto em `SMTP_USERNAME` e `SMTP_FROM_EMAIL` e a senha de app da conta em `SMTP_PASSWORD`. Guarde as credenciais no `.env` local, fora do Git.
3. Para testar só o backend, use `PASSWORD_RESET_URL=http://localhost:3000/redefinir-senha` e reinicie o servidor. Quando o frontend for publicado, configure no ambiente do backend a URL HTTPS da tela pública de redefinição.
4. No Swagger, envie o e-mail de uma conta de teste cadastrada a `POST /api/v1/auth/forgot-password`. A rota retorna `200` com uma mensagem genérica. Confira a caixa de entrada e o spam para confirmar a entrega.
5. Copie o valor do parâmetro `token` do link recebido e, em até 15 minutos, envie-o com `new_password` a `POST /api/v1/auth/reset-password`. Confira o `200`, faça login com a senha nova e confirme que repetir a redefinição com o mesmo token retorna `401`.

Para rodar os testes automatizados de recuperação a partir de `backend`, use `python -m pytest tests/integration/test_auth_password_reset.py`. Eles simulam o banco e o envio de e-mail.

### 7.2. Verificação do Front-end Mobile
- O Metro Bundler do Expo deve compilar sem erros no terminal.
- A tela inicial deve exibir o cabeçalho "ProtegEla - São Paulo", o placeholder da área do mapa e o botão de pânico visual ("PÂNICO (SOS)").

### 7.3. Testes Automatizados Unitários
Execute a partir da pasta `backend`:
```bash
pytest -v
```
Os testes configuram valores fictícios e fixos de Fernet, lookup e JWT antes de
importar a aplicação. Eles não usam as chaves privadas do seu ambiente. Esses
valores servem somente para testes e não devem ser copiados para um `.env` real.

Para executar apenas os testes desta correção, sem PostgreSQL:

```bash
pytest -v tests/unit/test_security_configuration.py tests/unit/test_database_logging.py
```

Os testes de criptografia iniciam processos separados e verificam a leitura após
reinício. Os testes de logs usam SQLite em memória. As integrações que precisam
de PostgreSQL são puladas quando suas variáveis de banco de testes não estão
configuradas. Use somente um banco descartável, como `protegela_test`; nunca aponte
essas variáveis para o banco compartilhado da equipe. Nesta correção, a pendência
dos testes de migração e demais casos dependentes de `TEST_DATABASE_SYNC_URL`
continua na Issue #38.

Também há testes unitários dos valores persistidos de categoria/período e testes de integração de relatos em `tests/integration/test_report_persistence.py`. Estes últimos exigem `TEST_DATABASE_SYNC_URL` apontando para um banco cujo nome termine em `_test`, com a migração aplicada e PostGIS ativo; sem essa variável, são explicitamente pulados. Cada teste reverte seus próprios dados. Eles verificam coordenadas/SRID, campos opcionais, autoria em publicação anônima e restrições de categoria, período e autoria.

O serviço de criação também possui testes unitários em `tests/unit/test_report_service.py`. Os testes de integração em `tests/integration/test_report_creation.py` usam a mesma variável de banco de testes, exigem a migração `0002_report_device_id` e verificam criações simultâneas e expiração da janela RN06. Estes testes confirmam transações para verificar o limite entre sessões e removem ao final apenas os relatos dos dispositivos aleatórios que criaram.

Os testes em `tests/integration/test_report_endpoint.py` verificam o contrato HTTP sem banco, com serviço e identidade substituídos explicitamente. A suíte `test_report_creation.py` também cobre o endpoint com serviço e banco reais, substituindo apenas a identidade de teste. Tokens válidos sem essa substituição recebem `503 AUTHENTICATION_UNAVAILABLE` até existir consulta real da conta; tokens inválidos ou ausentes recebem `401`. A validação adicional das claims possui testes em `tests/unit/test_access_token_subject.py`.

Para os testes da modelagem RF07, aplique também `0003_report_interactions`. As suítes de persistência e criação verificam o estado `is_hidden`, os tipos de interação e a unicidade por usuária/relato, inclusive em inserções simultâneas. As interações temporárias são revertidas ou removidas antes dos relatos que referenciam. Essa migração ainda não inclui chave estrangeira de usuária nem implementa os endpoints RF07.

A consulta de detalhes pode ser exercitada pelo serviço `ReportService.get_details` ou por `GET /api/v1/reports/{id}`, sem autenticação. Os testes em `test_report_service.py` e `test_report_creation.py` cobrem seu retorno público, contagem histórica de confirmações e rejeição de relatos inexistentes/ocultados.

As operações de serviço `confirm` e `report_abuse` possuem testes unitários em `tests/unit/test_report_interactions.py`. A suíte `test_report_creation.py` verifica também idempotência, conflitos, limiar de ocultação, concorrência entre sessões e reversão em falha de atualização. Nenhuma nova migração é necessária além de `0003_report_interactions` para esta etapa.

As rotas `POST /api/v1/reports/{id}/confirm` e `POST /api/v1/reports/{id}/report-abuse` aceitam corpo `{}` e exigem autenticação. Enquanto a consulta real de conta estiver pendente, tokens válidos recebem `503 AUTHENTICATION_UNAVAILABLE`; não há modo de autenticação fictícia na aplicação. `test_report_endpoint.py` cobre os contratos HTTP RF07 e `test_report_creation.py` cobre também o fluxo HTTP com serviço/banco reais, substituindo somente a identidade de teste. A seção de comentários continua dependente de RF08.

---

## 8. O Que Ainda NÃO Está Implementado nesta Etapa

Para evitar falsas expectativas, registre claramente:
- **A entrega integrada do registro de relatos ainda depende de autenticação e usuárias**: modelo, migrações, serviço e rota de criação já existem, mas ainda não há consulta real da conta nem chave estrangeira da autora. O endpoint permanece protegido e indisponível para criação até essa integração.
- Não há login real funcionando nem chamadas ativas para a Overpass API ou OpenRouteService.
- **Os endpoints `/status` dos módulos são pontos de ancoragem da arquitetura**: cada integrante da equipe será responsável por implementar as rotas e regras de negócio reais do seu respectivo módulo.
