# Contratos de API e Diretrizes de Integração

Este documento estabelece as diretrizes de integração entre as aplicações cliente (Mobile/Web) e o Back-end FastAPI do **ProtegEla**.

> [!IMPORTANT]
> Os contratos e endpoints listados nesta fase são **propostas arquiteturais iniciais sujeitas a aprovação formal da equipe** antes da implementação de regras de negócio específicas.

---

## 1. Princípios Gerais

1. **Versionamento e Prefixo**: Todos os endpoints devem obedecer ao padrão `/api/v1/{recurso}`. Mudanças que quebrem retrocompatibilidade exigirão nova versão (`/api/v2`).
2. **Formato dos Dados**: 100% das comunicações utilizam JSON UTF-8 (`Content-Type: application/json`).
3. **Convenção de Nomenclatura**:
   - Chaves de requisição e resposta JSON utilizam **`snake_case`** (consistente com Python e schemas Pydantic).
   - Identificadores de recurso utilizam UUID v4.
   - Datas e horários utilizam formato ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`).
4. **Idempotência**: Requisições de mutação crítica podem utilizar o cabeçalho opcional `X-Idempotency-Key` para evitar operações duplicadas em redes instáveis.

---

## 2. Autenticação e Identificação de Cliente

### 2.1. Usuárias Autenticadas (Login Real)
- O fluxo de autenticação retorna um par de tokens JWT:
  - **Access Token**: Curta duração (60 minutos), enviado via cabeçalho:
    ```http
    Authorization: Bearer <jwt_access_token>
    ```
  - **Refresh Token**: Longa duração (7 dias), utilizado exclusivamente no endpoint `/api/v1/auth/refresh`.

### 2.2. Acesso Sem Login (RF04)
- Para usuárias que optam por usar o mapa, rotas e pânico sem autenticação:
  - O aplicativo gera um identificador local pseudo-anônimo (UUID) persistido no cliente.
  - O cliente envia esse identificador no cabeçalho customizado:
    ```http
    X-Device-Id: 550e8400-e29b-41d4-a716-446655440000
    ```
  - Esse identificador é utilizado pelo servidor para aplicar rate limits de proteção e associar denúncias comunitárias temporárias contra spam (RN06).

---

## 3. Envelope Padronizado de Respostas e Erros

### 3.1. Resposta de Sucesso
Para coleções com paginação ou consultas regulares:
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_records": 105
  }
}
```

### 3.2. Resposta Padronizada de Erro (RFC 7807 Inspirado)
Toda falha (códigos HTTP 4xx e 5xx) deve obrigatoriamente retornar uma estrutura previsível:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Os dados fornecidos para o cadastro são inválidos.",
    "status_code": 422,
    "timestamp": "2026-10-13T13:45:00Z",
    "details": [
      {
        "field": "password",
        "issue": "A senha deve conter ao menos 8 caracteres, uma letra maiúscula, um número e um caractere especial (RN08)."
      }
    ]
  }
}
```

#### Códigos de Erro Padronizados Previstos
- `VALIDATION_ERROR` (422)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `RATE_LIMIT_EXCEEDED` (429)
- `EXTERNAL_SERVICE_UNAVAILABLE` (503)
- `INTERNAL_SERVER_ERROR` (500)

---

## 4. Timeouts e Resiliência a Falhas Externas (RNF10)

1. **Timeouts da API FastAPI**:
   - Chamadas HTTP do cliente para a API têm timeout padrão recomendado de **8 segundos**.
   - O aplicativo deve exibir estado amigável de carregamento e retry com backoff exponencial se houver erro transitório.
2. **Timeouts com Serviços Externos**:
   - Overpass API: Timeout estrito de **10 segundos**. Caso falhe, retorna estabelecimentos em cache prévio no banco de dados.
   - OpenRouteService: Timeout estrito de **8 segundos**. Em caso de falha, o cliente é avisado e pode receber rota offline básica em cache com aviso visual de alerta.

---

## 5. Proposta Inicial de Endpoints por Módulo

| Módulo | Método | Rota | Descrição | Status |
| :--- | :--- | :--- | :--- | :--- |
| **auth** | `POST` | `/api/v1/auth/register` | Cadastro de usuária e contatos de emergência (RF01) | Proposta em discussão |
| **auth** | `POST` | `/api/v1/auth/login` | Autenticação e emissão de tokens (RF02) | Proposta em discussão |
| **auth** | `POST` | `/api/v1/auth/refresh` | Renovação de Access Token | Proposta em discussão |
| **auth** | `POST` | `/api/v1/auth/forgot-password` | Solicitação de recuperação de senha (RF16) | Proposta em discussão |
| **users** | `GET` | `/api/v1/users/me` | Dados do perfil da usuária logada | Proposta em discussão |
| **users** | `PUT` | `/api/v1/users/me` | Atualização de perfil e preferências (RF17) | Proposta em discussão |
| **users** | `DELETE` | `/api/v1/users/me` | Exclusão definitiva de conta e dados (LGPD) | Proposta em discussão |
| **reports** | `GET` | `/api/v1/reports` | Listagem de incidentes com filtro por bounding box | Proposta em discussão |
| **reports** | `GET` | `/api/v1/reports/{id}` | Detalhes públicos de um relato visível (RF07) | Implementado |
| **reports** | `POST` | `/api/v1/reports` | Registro de incidente (RF09) | Rota implementada; consulta de conta pendente |
| **reports** | `POST` | `/api/v1/reports/{id}/confirm` | Confirmação da veracidade do relato (RN01) | Rota implementada; consulta de conta pendente |
| **reports** | `POST` | `/api/v1/reports/{id}/report-abuse` | Denúncia de relato falso/impróprio (RN06) | Rota implementada; consulta de conta pendente |
| **comments** | `GET` | `/api/v1/reports/{id}/comments` | Consulta de comentários e respostas (RF08) | Proposta em discussão |
| **comments** | `POST` | `/api/v1/reports/{id}/comments` | Inserção de comentário | Proposta em discussão |
| **risk_zones** | `GET` | `/api/v1/risk-zones` | Zonas de risco poligonais agregadas (RN03) | Proposta em discussão |
| **routes** | `POST` | `/api/v1/routes/calculate` | Cálculo de rota segura desviando de áreas de risco (RF15) | Proposta em discussão |
| **emergency** | `POST` | `/api/v1/emergency/panic` | Registro de acionamento do botão de pânico (RF14) | Proposta em discussão |
| **emergency** | `GET` | `/api/v1/emergency/useful-numbers`| Lista de telefones de utilidade pública (RF10) | Proposta em discussão |
| **support_locations**| `GET` | `/api/v1/support-locations/nearby` | Delegacias e hospitais próximos via OSM/Overpass (RF12) | Proposta em discussão |
| **notifications** | `POST` | `/api/v1/notifications/proximity-alert` | Verificação de entrada em zona de risco (RF13) | Proposta em discussão |
| **core** | `GET` | `/api/v1/health` | Healthcheck de integridade do backend e banco | Aprovado |

---

## 6. Registro de Relato — RF09

Esta seção detalha apenas o cadastro de incidentes no backend, conforme as decisões revisadas nesta issue. Schemas, serviço e rota estão implementados; a entrega integrada ainda depende da consulta real da conta e da chave estrangeira da autora. Até essa integração, tokens válidos recebem `503 AUTHENTICATION_UNAVAILABLE`, sem criar relatos.

### 6.1. Requisição

`POST /api/v1/reports`, com `Content-Type: application/json`, `Authorization: Bearer <jwt_access_token>` e `X-Device-Id: <uuid_v4>` obrigatórios.

O acesso exige uma usuária autenticada. `X-Device-Id` sozinho não autoriza a criação. A autora é determinada pelo servidor a partir da autenticação; o corpo não aceita `author_id`, contadores, classificação de risco ou campos de moderação.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `location` | objeto | Sim | Local do incidente, informado por GPS ou seleção no mapa pelo cliente. |
| `location.latitude` | número | Sim | Valor finito entre -90 e 90. |
| `location.longitude` | número | Sim | Valor finito entre -180 e 180. |
| `location.address_reference` | string ou null | Não | Complemento ou referência de endereço, com até 255 caracteres após normalização. |
| `category` | string | Sim | Um dos valores exatos: `Assédio`, `Violência`, `Furto`, `Má iluminação`. |
| `description` | string ou null | Não | Descrição sucinta do ocorrido, com até 1.000 caracteres após normalização. |
| `incident_date` | string | Sim | Data civil do incidente no formato `YYYY-MM-DD`, não posterior à data atual em `America/Sao_Paulo`. |
| `incident_period` | string | Sim | `manha`, `tarde`, `noite` ou `madrugada`. |
| `incident_time` | string ou null | Não | Horário local do incidente no formato `HH:MM`, quando conhecido. |
| `is_anonymous` | boolean | Sim | Indica se a identidade da autora deve ser ocultada publicamente. |

Os nomes e as categorias preservam os tipos existentes em `apps/mobile/src/types/report.ts`; `incident_time` é um acréscimo para atender ao horário opcional do requisito. Nenhuma alteração no frontend faz parte desta entrega.

```json
{
  "location": {
    "latitude": -23.55052,
    "longitude": -46.633308,
    "address_reference": "Próximo à praça"
  },
  "category": "Má iluminação",
  "description": "Trecho com postes apagados.",
  "incident_date": "2026-10-25",
  "incident_period": "noite",
  "incident_time": "20:30",
  "is_anonymous": true
}
```

### 6.2. Resposta de Sucesso

`201 Created`, com envelope `data`, sem metadados de paginação. Campos opcionais ausentes na entrada são representados por `null` na resposta. O fluxo de sucesso é exercitado com substituição explícita da identidade apenas nos testes, enquanto a consulta de conta estiver pendente.

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "location": {
      "latitude": -23.55052,
      "longitude": -46.633308,
      "address_reference": "Próximo à praça"
    },
    "category": "Má iluminação",
    "description": "Trecho com postes apagados.",
    "incident_date": "2026-10-25",
    "incident_period": "noite",
    "incident_time": "20:30",
    "is_anonymous": true,
    "created_at": "2026-10-26T17:00:00Z"
  }
}
```

A resposta de criação não expõe identificadores da autora nem dados pessoais. O anonimato mantém a autoria internamente para controle de acesso, edição e exclusão futuras, ocultando-a na apresentação pública.

### 6.3. Erros e Integração Futura

- `401 UNAUTHORIZED`: credencial ausente, inválida, expirada ou que não seja um token de acesso.
- `422 VALIDATION_ERROR`: campos ou cabeçalhos obrigatórios ausentes ou inválidos (exceto autenticação, que retorna 401), categoria ou período desconhecido, coordenadas ou formatos inválidos, textos acima dos limites, data futura, horário incompatível com o período ou campos não aceitos.
- `429 RATE_LIMIT_EXCEEDED`: tentativa de exceder 5 relatos criados por dispositivo em uma janela móvel de 60 segundos (RN06).
- `503 AUTHENTICATION_UNAVAILABLE`: token válido, mas consulta de existência da conta ainda indisponível. Nenhum relato é criado nessa situação.

Os erros seguem o envelope da seção 3.2. A implementação deve verificar a usuária autenticada; login e modelo de usuária ainda não estão implementados na estrutura atual.

O local persistido representa o incidente, não um histórico de deslocamento. Para a futura consulta no mapa, manter UUID e coordenadas estáveis, com ponto PostGIS em SRID 4326 e ordem geométrica longitude/latitude. A API usa campos nomeados para evitar ambiguidade. Criar um relato não o classifica automaticamente como zona de risco; agrupamento, confirmações e pontuação ficam fora desta issue.

### 6.4. Decisões Aprovadas para Esta Issue

As escolhas abaixo foram aprovadas na revisão do passo 2, em 2026-10-26. As definições de autenticação e integração ainda pendentes estão na seção 6.5.

- Remover espaços nas extremidades da descrição e da referência de endereço; converter texto vazio após essa normalização em `null`. Validar os limites de 1.000 e 255 caracteres, respectivamente, após normalizar.
- Interpretar data e horário do incidente em `America/Sao_Paulo`. Rejeitar datas posteriores à data atual nesse fuso. Manter data e horário separados e não inventar horário quando desconhecido; `created_at` continua sendo um instante UTC. Essa é uma exceção à convenção geral da seção 1 para datas civis e horários parciais.
- Usar os períodos `madrugada` (00:00–05:59), `manha` (06:00–11:59), `tarde` (12:00–17:59) e `noite` (18:00–23:59). Quando informado, o horário deve pertencer ao período escolhido.
- Tratar anonimato como público, preservando a autoria interna.
- Adotar como política inicial até 5 relatos criados por dispositivo em uma janela móvel de 60 segundos, exigindo `X-Device-Id` UUID v4 também em requisições autenticadas. Um identificador fornecido pelo cliente não impede sozinho a troca de identificadores e não deve ser interpretado como prova de identidade.

### 6.5. Dependências e Decisões Ainda Pendentes

- Compatibilizar o envio de `X-Device-Id` com o frontend em sua entrega futura: o cliente atual envia token ou identificador de dispositivo. Nenhuma mudança no frontend está incluída nesta issue de backend.
- Integração com autenticação e tabela de usuárias, incluindo a chave estrangeira da autora e o tratamento dessa associação na exclusão da conta.
- Reenvio após timeout: não realizar repetição automática de criação sem definir e implementar a semântica de idempotência. O cabeçalho opcional citado na seção 1 não implica suporte já existente neste endpoint.

### 6.6. Integração Planejada com Autenticação e Usuárias — Passo 3

**Estado atual:** `core/security.py` emite tokens com `sub`, `iat`, `exp` e `type`, e disponibiliza `decode_token`. O módulo `auth` agora valida as claims de acesso, mas ainda não há modelo `User`, consulta de usuária autenticada ou fluxo real de login. Decodificar um token sozinho não comprova que a conta continua existindo.

**Fluxo proposto para a implementação:**

1. Uma dependência HTTP de autenticação extrai o Bearer token e delega a validação ao módulo de autenticação. Credenciais ausentes ou rejeitadas retornam `401 UNAUTHORIZED` no envelope padrão.
2. A validação reutiliza as funções criptográficas existentes, exige assinatura e expiração válidas, presença de `exp` e `sub`, `type` igual a `access` e `sub` correspondente a um UUID v4 válido. Refresh tokens não autorizam registro de relatos. As verificações adicionais ao helper `decode_token` estão implementadas em `auth/service.py`, na função `validate_access_token_subject`.
3. O módulo de autenticação consulta a conta correspondente por meio do serviço de usuárias ou de um repositório específico. Conta inexistente retorna `401`; não se consulta o banco dentro do router de relatos.
4. A dependência entrega ao caso de uso de relatos a identidade autenticada com seu UUID. `ReportService` recebe essa identidade separadamente dos dados do incidente, sem depender de `Request`, Bearer token ou detalhes HTTP.
5. A persistência associa `author_id` à usuária existente, inclusive em relatos publicados anonimamente. A definição da chave estrangeira e da migração depende do modelo real de usuárias; não criar uma tabela de usuárias fictícia nem aceitar um UUID arbitrário como substituto de autenticação.

**Desenvolvimento e testes enquanto essa dependência não estiver disponível:** testar o serviço com identidades e persistência controladas; nos testes HTTP, substituir explicitamente a dependência de autenticação por uma identidade de teste. Essas substituições ficam restritas aos testes. A entrega integrada não pode ser considerada concluída sem verificar a consulta real da usuária e a chave estrangeira em PostgreSQL, nem pode liberar criação sem autenticação como alternativa temporária.

**Limites desta issue:** não implementar cadastro, login, recuperação de senha ou o perfil completo. A localização do incidente fica no módulo de relatos; a autenticação não deve persistir coordenadas. A política de exclusão de conta e seus efeitos nos relatos precisa ser alinhada com o módulo de usuárias antes de definir ações de exclusão na chave estrangeira.

### 6.7. Serviço de Criação — Passo 6

`ReportService.create` recebe os dados do incidente separados da identidade autenticada e do identificador de dispositivo. Normaliza textos, valida as regras aprovadas e confirma a persistência em uma transação, revertendo falhas de persistência ou limite excedido. A integração HTTP está descrita na seção 6.8; a consulta de conta permanece pendente.

O campo interno `reports.device_id` permite aplicar a RN06 com índice em dispositivo e instante de criação. A migração `0002_report_device_id` aceita `null` para registros anteriores; novas criações pelo serviço exigem UUID v4. Esse campo não integra a resposta pública, não substitui a identidade autenticada e não é usado para histórico de deslocamentos.

Para concorrência entre processos, o serviço serializa as criações do mesmo dispositivo por bloqueio transacional PostgreSQL e conta relatos nos últimos 60 segundos após adquirir o bloqueio, sob isolamento READ COMMITTED. Utiliza o relógio do banco para a janela e o instante de criação. O bloqueio é liberado ao confirmar ou reverter a transação; não depende de um contador em memória que desapareça ao reiniciar o backend.

### 6.8. Schemas e Rota HTTP — Passo 7

`reports/schemas.py` define entrada e saída, rejeita campos desconhecidos inclusive em `location`, exige booleano de anonimato e coordenadas numéricas, e restringe data e horário aos formatos documentados. `reports/router.py` injeta identidade, dispositivo e serviço, sem consultas ao banco ou regras de negócio no router. A resposta é construída por lista explícita de campos públicos, sem `author_id`, `device_id` ou dados de moderação; o horário usa `HH:MM` e `created_at` usa UTC com sufixo `Z`.

A dependência `auth/dependencies.py:get_current_author` rejeita credenciais inválidas com o envelope `401 UNAUTHORIZED`. Após validar o token, retorna temporariamente `503 AUTHENTICATION_UNAVAILABLE`, pois a consulta de conta ainda não existe. Ao implementar o módulo de usuárias, essa dependência deverá consultar a conta via serviço/repositório e somente então entregar sua identidade; conta inexistente deverá retornar `401`. Não habilitar o retorno direto de `sub` como atalho. Os testes HTTP de sucesso substituem explicitamente essa dependência e cobrem também criação com serviço/PostgreSQL reais, validações e limite `429`.

### 6.9. Preparação para Exibição no Mapa — Passo 8

O cadastro mantém incidentes individuais com UUID, categoria, localização e dados temporais. Não gera polígonos nem calcula confiabilidade. A futura issue de consulta pode usar esses dados sem alterar o payload de criação apenas para desenhar os pontos.

| Aspecto | Disponível no cadastro | Responsabilidade da próxima entrega |
| :--- | :--- | :--- |
| Identificação | UUID estável de cada relato. | Usar o UUID para identificar marcadores e consultar detalhes. |
| Localização | Ponto PostGIS SRID 4326, com índice GiST; resposta com latitude e longitude nomeadas. | Implementar consulta da área visível aproveitando o índice espacial; definir e documentar parâmetros e limites da consulta. |
| Categoria | Uma das quatro categorias aprovadas. | Associar ícones/cores sem mudar os valores compartilhados. |
| Dados temporais | Data/período/horário do incidente separados de `created_at`. | Manter essa distinção na apresentação e nas futuras regras de validade. |
| Privacidade | Autora e dispositivo internos; `is_anonymous` público. | Preservar a ocultação de identidade em listagens e detalhes, sem expor identificadores internos. |
| Risco e moderação | Nenhuma confirmação, denúncia, pontuação ou ocultação implementada. | Definir a projeção de leitura com as regras dos módulos responsáveis, sem considerar todo novo relato uma zona de risco. |

Cuidados para a implementação futura:

- Em PostGIS e em eventual GeoJSON, pontos usam longitude antes de latitude. Não inverter os campos nomeados da API ao construir a geometria.
- Coordenadas em SRID 4326 são angulares. O raio de 20 metros da RN03 exige cálculo métrico adequado, por exemplo com `geography` ou projeção apropriada; não usar 20 como distância diretamente em graus. A estratégia e os índices dessa agregação pertencem à issue de zonas de risco.
- `GET /api/v1/reports` e `GET /api/v1/risk-zones` continuam propostas sem implementação. Formato de bounding box, paginação/limites, resposta de consulta e tratamento de relatos ocultados devem ser definidos antes de implementar a listagem. Isso não altera o contrato de criação aprovado nesta issue.
- O tipo atual `Report` do frontend ainda não é equivalente à resposta de criação: exige contadores e `is_hidden`, não declara `incident_time` e representa campos opcionais sem `null`. A futura integração deve distinguir o retorno do cadastro da projeção de consulta, incorporar o horário opcional e tratar a nulabilidade documentada. Não preencher campos de risco/moderação com valores fictícios para contornar essa diferença.
- A criação atual representa relatos comunitários. Importação da SSP-SP, procedência de dados oficiais e validade estendida são entregas futuras; o modelo atual não implementa essa importação.

Nenhum endpoint de consulta, alteração no frontend, agrupamento espacial ou integração com motor de rotas faz parte deste passo de revisão.

### 6.10. Revisão Final — Passo 9

A revisão executou 114 testes, incluindo persistência, concorrência, expiração do limite e fluxo HTTP com PostgreSQL/PostGIS reais. A cobertura medida nos módulos de relatos e nos arquivos de autenticação alterados foi de 99%, incluindo ramos; esse número se restringe ao código exercitado, não representa cobertura de todo o backend nem valida uma consulta de usuárias ainda inexistente. Ruff e a verificação do diff passaram. O README principal permanece inalterado e `backend/.env` está ignorado pelo Git.

**A issue ainda não deve ser marcada como entrega integrada concluída.** Restam:

- Implementar a consulta real da conta na dependência de autenticação, retornar `401` para conta inexistente e testar o fluxo sem substituição da identidade.
- Integrar `author_id` à tabela real de usuárias com uma nova migração e política de exclusão alinhada com o módulo responsável.
- Tratar a exposição de parâmetros SQL no núcleo compartilhado: `core/database.py` usa `echo=settings.DEBUG`, sem ocultação de parâmetros, enquanto o padrão de `DEBUG` é verdadeiro. Isso pode registrar geometria, textos e identificadores nas operações de relatos, contrariando a política de logs. A correção deve ser alinhada por envolver `core/`; avaliar desativar o log SQL e/ou configurar ocultação de parâmetros, verificando também mensagens de erro. Os testes desta revisão foram executados com `DEBUG=false`.

O ambiente de testes usou SQLAlchemy 2.0, dentro da faixa declarada no projeto. A instalação com SQLAlchemy 2.1 revelou que o suporte assíncrono exige `greenlet` sem que a declaração atual garanta sua instalação. Nenhuma dependência foi acrescentada nem sua faixa alterada nesta issue; ajustar a reprodutibilidade do ambiente exige uma decisão da equipe.

## 7. Descrição de Pontos de Perigo — RF07

### 7.1. Escopo Aprovado — Passo 1

A implementação inicial do backend será centrada no **relato individual**, identificado por UUID. A consulta planejada é `GET /api/v1/reports/{id}`; confirmações, denúncias e comentários referenciam esse relato. O detalhamento dos payloads, respostas e regras dessas operações será revisado nos próximos passos, antes da implementação.

O RF07 também menciona um marcador de zona de risco, mas uma zona poderá agrupar vários relatos conforme a RN03. Portanto, relato e zona não serão tratados como o mesmo recurso. Quando o agrupamento estiver disponível, a navegação a partir da zona poderá apresentar os relatos que a compõem; consulta da zona, associação zona/relatos e navegação ficam como integração futura. Esta primeira entrega não conclui o fluxo de detalhes de zonas agrupadas.

Fronteiras desta issue:

- `reports`: detalhes do relato individual, confirmações e denúncias, preservando autoria interna e anonimato público.
- `comments` (RF08): leitura e gerenciamento de comentários/respostas; o RF07 dependerá do contrato de consulta desse módulo, sem duplicar suas regras nem simular uma lista vazia enquanto a consulta não existir.
- `risk_zones`: agrupamento espacial, composição de zonas, classificação e pontuação de risco.
- Frontend: marcador, modal e navegação visual, fora do escopo desta implementação de backend.

A aprovação deste passo define o recurso e as fronteiras da entrega. Ainda não define políticas de voto, moderação, paginação de comentários ou novos contratos de consulta de zonas.

### 7.2. Contratos HTTP Aprovados — Passo 2

Os formatos desta seção foram aprovados no passo 2. Detalhes, confirmação e denúncia estão implementados conforme o passo 8; a leitura de comentários continua dependente de RF08. As regras de negócio estão na seção 7.3. O payload e a resposta do cadastro RF09 permanecem preservados.

| Operação | Método e rota | Autenticação | Sucesso proposto |
| :--- | :--- | :--- | :--- |
| Detalhar um relato | `GET /api/v1/reports/{id}` | Não exige login. | `200 OK`, com `data`. |
| Confirmar um relato | `POST /api/v1/reports/{id}/confirm` | Access token e conta existente. | `200 OK`, com `data`. |
| Denunciar um relato | `POST /api/v1/reports/{id}/report-abuse` | Access token e conta existente. | `200 OK`, com `data`. |
| Ler comentários | `GET /api/v1/reports/{id}/comments` | Não exige login. | Contrato e implementação a alinhar com RF08. |

`{id}` identifica o UUID v4 do relato. As mutações usam `Authorization: Bearer <jwt_access_token>` e corpo JSON `{}`, sem campos adicionais. O servidor identifica a usuária pela autenticação; o corpo não aceita autora, contadores, estado de moderação ou decisão de ocultação. `X-Device-Id` não substitui autenticação e o limite de cinco criações da seção 6 não se aplica automaticamente a confirmações ou denúncias.

#### 7.2.1. Detalhes Públicos

Exemplo de `200 OK` para `GET /api/v1/reports/550e8400-e29b-41d4-a716-446655440000`:

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "location": {
      "latitude": -23.55052,
      "longitude": -46.633308,
      "address_reference": "Próximo à praça"
    },
    "category": "Má iluminação",
    "description": "Trecho com postes apagados.",
    "incident_date": "2026-10-25",
    "incident_period": "noite",
    "incident_time": "20:30",
    "is_anonymous": true,
    "created_at": "2026-10-26T17:00:00Z",
    "confirmations_count": 3
  }
}
```

Os campos do relato mantêm a semântica e a nulabilidade da seção 6: descrição, referência de endereço e horário desconhecidos são `null`. `confirmations_count` é o total de usuárias distintas que confirmaram o relato, sem corte temporal, obtido dos registros reais de confirmação. O exemplo não implica que já existam confirmações persistidas.

A resposta não contém `author_id`, `device_id`, lista de quem confirmou/denunciou nem número de denúncias. O RF07 não exige exibir o nome da autora do relato; esta proposta mantém esses dados fora da consulta pública, inclusive quando a publicação não for anônima. A consulta de detalhes não depende de personalização por usuária autenticada.

Não retornar uma string de tempo decorrido produzida pelo backend. O cliente poderá calcular o tempo desde a publicação a partir de `created_at`, enquanto data, período e horário descrevem o incidente. Se o horário do incidente não foi informado, não inventar um instante exato para exibir sua idade.

**Limitação de endereço:** o modelo atual guarda coordenadas e uma referência opcional, não um endereço postal completo. A consulta retornará os dados existentes; o atendimento do critério de endereço precisa ser alinhado, sem adicionar geocodificação externa implicitamente nesta issue.

#### 7.2.2. Confirmação

Requisição proposta:

```http
POST /api/v1/reports/550e8400-e29b-41d4-a716-446655440000/confirm
Authorization: Bearer <jwt_access_token>
Content-Type: application/json

{}
```

Resposta de sucesso proposta:

```json
{
  "data": {
    "report_id": "550e8400-e29b-41d4-a716-446655440000",
    "confirmed": true
  }
}
```

`confirmed` informa que a confirmação dessa usuária está registrada. Não representa classificação de zona de risco. Repetir uma confirmação em relato visível retorna o mesmo sucesso, sem duplicação ou renovação da data da confirmação. A autora não pode confirmar o próprio relato; quem já denunciou não pode confirmar, conforme a seção 7.3.

#### 7.2.3. Denúncia

`POST /api/v1/reports/{id}/report-abuse`, com os mesmos cabeçalhos e corpo `{}` da confirmação.

Resposta de sucesso proposta:

```json
{
  "data": {
    "report_id": "550e8400-e29b-41d4-a716-446655440000",
    "abuse_registered": true
  }
}
```

`abuse_registered` informa que a denúncia dessa usuária está registrada. A resposta não publica o total de denúncias nem decisões internas de moderação. Não há campo de justificativa ou categoria de denúncia, pois isso não foi definido nos requisitos. Repetir uma denúncia em relato ainda visível retorna o mesmo sucesso, sem duplicação ou renovação da data. A autora não pode denunciar o próprio relato; quem já confirmou não pode denunciar. A denúncia que provoca ocultação retorna sucesso; requisições posteriores ao relato ocultado retornam `404`, conforme a seção 7.3.

#### 7.2.4. Comentários e Dependência do RF08

Os detalhes do relato não incluem uma coleção de comentários embutida. A seção de comentários fará uma consulta separada a `GET /api/v1/reports/{id}/comments`, cujo formato de resposta, paginação, ordem e representação de respostas encadeadas precisam ser acordados com RF08. Isso evita uma resposta de detalhes com tamanho ilimitado e duplicação das regras de comentários.

O README do módulo `comments` ainda cita `/api/v1/comments/*`, enquanto a tabela de contratos propõe a consulta aninhada no relato. Alinhar essa divergência com RF08 antes de implementar a consulta. O RF07 não deve criar um endpoint fictício que retorne `[]` para encobrir essa dependência.

#### 7.2.5. Erros

Todas as operações seguem o envelope de erro da seção 3.2:

- `404 NOT_FOUND`: relato inexistente ou ocultado, sem distinguir os dois casos na resposta pública.
- `403 FORBIDDEN`: a autora tenta confirmar ou denunciar o próprio relato visível.
- `409 INTERACTION_CONFLICT`: a usuária tenta confirmar um relato que já denunciou ou denunciar um relato que já confirmou, sem substituir a primeira ação.
- `422 VALIDATION_ERROR`: UUID inválido ou corpo de mutação diferente do objeto vazio previsto, incluindo campos não aceitos.
- `401 UNAUTHORIZED`: credencial ausente, inválida, expirada, refresh token ou conta inexistente, nas operações autenticadas.
- `503 AUTHENTICATION_UNAVAILABLE`: validação da conta indisponível, nas operações autenticadas. Mantém a proteção adotada no RF09 enquanto o módulo de usuárias estiver pendente; não deve bloquear a consulta pública de detalhes.

As regras correspondentes estão na seção 7.3. A criação de comentários e suas regras continuam sob RF08.

### 7.3. Regras de Negócio Aprovadas — Passo 3

As decisões abaixo foram aprovadas para esta issue; não representam operações já implementadas.

#### 7.3.1. Autoria e Interações

- A autora do relato não pode confirmá-lo nem denunciá-lo, mesmo quando a publicação é anônima. A comparação usa a autoria interna e a identidade autenticada, nunca dados enviados no corpo.
- Cada usuária pode ter no máximo uma confirmação ou uma denúncia por relato. A segunda ação de tipo diferente retorna `409 INTERACTION_CONFLICT`, preservando o registro original.
- Repetir a mesma ação em relato visível retorna `200` com a mesma estrutura de sucesso, sem novo registro, incremento de contadores ou alteração de seu instante original. Isso não renova a validade da confirmação para a RN01.
- A prevenção de duplicações e de interações opostas precisa funcionar também entre requisições simultâneas, por meio de transação e restrições de persistência adequadas, não apenas verificações no código antes da inserção.

#### 7.3.2. Contagem e Classificação

`confirmations_count` representa o total de usuárias distintas que confirmaram, independentemente da idade da confirmação. O corte de seis meses da RN01 pertence à classificação de risco e não altera silenciosamente esse contador público. Nenhuma confirmação individual classifica automaticamente o relato como uma zona de risco.

#### 7.3.3. Ocultação pela RN06

Aplicar literalmente a condição: ocultar quando o total de denúncias distintas for **maior que 30%** do total de confirmações distintas. Para evitar divisão por zero e imprecisão de ponto flutuante, a condição pode ser avaliada como `10 * denuncias > 3 * confirmacoes`, usando os totais registrados do relato.

| Confirmações | Denúncias | Resultado |
| :--- | :--- | :--- |
| 0 | 0 | Não ocultar por essa regra. |
| 0 | 1 | Ocultar. |
| 3 | 1 | Ocultar: uma denúncia supera 30% de três confirmações. |
| 10 | 3 | Não ocultar: exatamente 30% não supera o limiar. |
| 10 | 4 | Ocultar. |

A denúncia aceita e a eventual ocultação devem ser persistidas na mesma transação. Se essa denúncia ocultar o relato, ela ainda retorna `200` com `abuse_registered: true`. O sucesso significa registro da denúncia, sem expor o resultado interno da moderação.

Após a ocultação, a consulta pública e novas confirmações/denúncias retornam `404 NOT_FOUND`. Isso inclui a repetição da ação que causou a ocultação: a política de visibilidade tem prioridade sobre o sucesso de repetição. Para requisições autenticadas e estruturalmente válidas, verificar existência/visibilidade antes de permissões da autora ou conflitos de interação, sem revelar o estado de um relato ocultado. Falhas de autenticação continuam seguindo `401`/`503` conforme o contrato.

Não implementar restauração automática ou endpoint administrativo nesta issue. O relato permanece ocultado até uma futura revisão, cujo fluxo é uma dependência explícita. A futura listagem e o motor de rotas deverão excluir relatos ocultados, conforme a RN06; essas consultas não são implementadas aqui. O comportamento dos comentários de relatos ocultados também precisa ser coordenado com RF08 para evitar exposição indireta do conteúdo.

#### 7.3.4. Pendências de Integração

Continuam pendentes o alinhamento com usuários/autenticação e política de exclusão de conta, o contrato de leitura de comentários do RF08, a decisão sobre apresentação de endereço com os dados disponíveis e o fluxo futuro de revisão/restauração. Não criar tabelas de usuárias fictícias, geocodificação externa ou operações administrativas para contornar essas dependências.

### 7.4. Dependências de Usuárias e Comentários — Passo 4

**Estado verificado nesta branch:** `users/models.py` e `users/service.py` ainda são estruturas iniciais; a implementação feita por outro integrante ainda não está integrada. `auth/dependencies.py:get_current_author` valida o token e mantém `503 AUTHENTICATION_UNAVAILABLE` até existir consulta da conta. O módulo `comments` também não possui modelo ou consulta reais. Esta seção registra o ponto de integração esperado e os acordos necessários; não presume aprovação de contratos pela outra pessoa nem disponibilidade de código que não está nesta branch.

#### 7.4.1. Integração com Usuárias e Autenticação

- As operações de confirmação e denúncia usarão a dependência de identidade já adotada no RF09, sem implementar outro fluxo de login. Se a implementação de autenticação trouxer outro nome ou retorno, adaptar a integração em um único ponto, preservando o UUID v4 da conta.
- O serviço de relatos receberá a identidade autenticada separadamente dos dados HTTP. Para impedir interação da autora, comparará essa identidade a `Report.author_id`, inclusive em publicações anônimas.
- A consulta pública de detalhes não exigirá token nem buscará a conta da autora para construir a resposta: os campos públicos aprovados não incluem identificação pessoal da autora. A indisponibilidade da autenticação não deve tornar indisponível essa consulta pública.
- A existência da conta deve ser verificada pela dependência de autenticação via serviço/repositório de usuárias, sem consulta no router de relatos. Tokens válidos não podem ser aceitos apenas com base em `sub`.
- Antes de integrar as migrações, combinar com o responsável o nome real da tabela/coluna de usuárias, tipo do identificador e política de exclusão. As interações precisam preservar unicidade por usuária/relato e coerência das contagens; o efeito da exclusão de uma conta nesses registros e na moderação não será decidido implicitamente por uma ação de chave estrangeira.
- Enquanto o modelo de usuárias não estiver integrado, não inventar uma tabela substituta. A modelagem pode representar os identificadores internos e a associação com o relato existente, deixando a chave estrangeira de usuária explicitamente pendente, como já ocorre em `Report.author_id`. Isso é uma limitação intermediária, não integridade referencial concluída.

#### 7.4.2. Integração com Comentários — RF08

- A consulta dos comentários será responsabilidade do módulo `comments`, pela rota aninhada proposta na seção 7.2.4, após alinhamento com RF08. O detalhe do relato continua independente dessa coleção; não haverá chamadas HTTP internas entre módulos.
- Acordar resposta, paginação, ordenação e representação de respostas encadeadas antes de implementar a consulta. A identificação do relato será o UUID do mesmo `Report` consultado no RF07; cada resposta deve permanecer na discussão do relato de seu comentário pai.
- A consulta de comentários precisará respeitar a existência e a visibilidade do relato para não expor indiretamente conteúdo ocultado. Ao implementar RF08, coordenar uma consulta reutilizável no serviço de relatos ou em repositório específico, sem repetir regras de visibilidade em routers.
- A autoria pública de comentários é um requisito próprio do RF08; não expor e-mail, telefone ou identificadores internos de conta para atendê-lo. O anonimato do relato não define automaticamente uma política de anonimato para comentários.
- Não implementar comentários nesta issue, nem retornar uma lista vazia para simular a dependência. A seção de comentários do RF07 continua pendente até a integração real com RF08.

#### 7.4.3. Testes e Integração no Git

Desenvolver as regras de relatos com identidades substituídas explicitamente nos testes, mantendo as operações autenticadas protegidas na aplicação real. Os testes públicos de detalhes deverão funcionar sem substituição de autenticação. Após integrar usuários, testar conta existente/inexistente, permissões da autora e chaves estrangeiras sem substituições; após integrar comentários, verificar o vínculo com o relato e a política de visibilidade.

Integrar primeiro os contratos acordados e depois compatibilizar as branches. Conferir especialmente `auth/service.py`, `auth/dependencies.py` e o histórico de migrações Alembic, que podem receber alterações paralelas. Não reescrever silenciosamente migrações já aplicadas por colegas; verificar e reconciliar eventuais heads antes da integração final.

### 7.5. Modelagem de Interações e Ocultação — Passo 5

`ReportInteraction` representa confirmações e denúncias em uma única tabela `report_interactions`, diferenciadas por `ReportInteractionKind` (`confirmation` ou `abuse`). Os dois tipos compartilham UUID próprio, relato, usuária e instante de criação; não há subclasses ou tabelas duplicadas com os mesmos campos.

A restrição única `(report_id, user_id)` impede tanto repetição quanto interação oposta, inclusive em inserções concorrentes. A aplicação ainda deverá distinguir repetição idempotente de conflito ao implementar o serviço. A chave estrangeira `report_id` referencia o relato real, sem exclusão em cascata implícita; `user_id` é obrigatório, mas sua chave estrangeira aguarda a integração com usuárias e a política de exclusão. O índice `(report_id, kind)` atende à consulta das contagens de cada tipo. Não há contadores materializados nesta etapa.

`Report.is_hidden` é booleano obrigatório com padrão falso na aplicação e no banco. A migração `0003_report_interactions`, após `0002_report_device_id`, acrescenta esse campo e a tabela de interações; relatos anteriores recebem falso sem alteração dos dados existentes. A migração foi aplicada, comparada com os modelos, revertida e reaplicada em `protegela_test`; também foi verificada a preservação de um relato criado antes da adição do campo. Reverter essa migração elimina interações e o estado de ocultação, portanto não deve ser feito em bancos com dados a preservar.

Foram executados 129 testes, incluindo persistência dos dois tipos de interação, unicidade para ações iguais/opostas, concorrência entre sessões, referência a relato existente e estado de ocultação. As verificações não equivalem à implementação das regras de permissão ou da RN06: impedimento da autora, respostas idempotentes/conflitos, contagem pública, ocultação automática e filtragem de relatos ocultados serão implementados nos próximos passos. Os endpoints RF07 permanecem apenas documentados nesta etapa.

### 7.6. Consulta de Detalhes no Serviço — Passo 6

`ReportService.get_details(report_id)` está implementado sem dependência de identidade autenticada ou consulta de usuárias. Valida o UUID e seleciona apenas relatos com `is_hidden=false`; para relato inexistente ou ocultado lança o mesmo `EntityNotFoundException`, com código `NOT_FOUND` e status 404, sem distinguir os casos.

A seleção dos dados e a contagem das confirmações são feitas em uma única consulta SQL, no mesmo snapshot. A contagem considera apenas interações `confirmation` do relato solicitado, sem corte temporal. A restrição única por usuária/relato garante a distinção das confirmações; denúncias e interações de outros relatos não entram na contagem. Relatos sem confirmações retornam zero.

O retorno é a projeção imutável `ReportDetails`, separada do modelo ORM e dos schemas HTTP. Inclui os campos públicos do relato e a contagem, sem autoria interna, dispositivo, total de denúncias ou estado de moderação. A geometria é convertida em latitude/longitude nomeadas; data e horário do incidente permanecem separados de `created_at`, preservando valores opcionais. A leitura não modifica registros nem confirma transações.

Foram executados 139 testes, incluindo consulta real em PostgreSQL/PostGIS para publicações anônimas e não anônimas, contagem de confirmações antigas, exclusão de denúncias/outros relatos da contagem e filtragem de ocultados. Os testes unitários verificam também a projeção pública e ausência de escrita. Não houve mudança de schema ou criação de rota HTTP neste passo; a exposição de `GET /api/v1/reports/{id}` permanece para o passo 8.

### 7.7. Confirmação, Denúncia e Ocultação no Serviço — Passo 7

`ReportService.confirm(report_id, user_id=...)` e `report_abuse(report_id, user_id=...)` estão implementados. Recebem a identidade que o chamador deve ter autenticado, sem aceitar credenciais HTTP ou consultar contas por conta própria. As duas operações compartilham a aplicação das regras da seção 7.3; retornam sem dados internos quando bem-sucedidas e usam as exceções padronizadas para erros.

Cada operação adquire um bloqueio de linha (`SELECT ... FOR UPDATE`) no relato visível. Sob READ COMMITTED, isso serializa as interações do mesmo relato entre sessões, inclusive de usuárias diferentes. Após adquirir o bloqueio, verifica autoria e interação prévia. Repetição confirma a transação para liberar o bloqueio, sem alterar registro ou data; ação oposta retorna `409 INTERACTION_CONFLICT` e interação da autora retorna `403 FORBIDDEN`. Relato inexistente ou já ocultado retorna `404 NOT_FOUND` antes dessas verificações.

Uma nova interação é inserida na mesma transação. Para denúncia, o serviço conta os tipos registrados após a inserção e aplica `10 * denuncias > 3 * confirmacoes`. A eventual atualização de `is_hidden` é confirmada junto da denúncia. Se qualquer etapa falhar, a transação é revertida, sem persistência parcial. Não há restauração automática. A restrição única da tabela permanece como proteção adicional, enquanto o bloqueio permite tratar repetições e conflitos de forma consistente.

A suíte executou 172 testes, incluindo persistência e concorrência reais em PostgreSQL/PostGIS. Foram verificados limiares exatos, zero confirmações, preservação da data original em repetições, ações opostas simultâneas, denúncias de usuárias diferentes e interrupção das interações após ocultação. Uma falha simulada na atualização de ocultação comprovou a reversão da denúncia já inserida e a liberação do bloqueio. Não houve nova alteração de schema nesta etapa.

As rotas RF07 ainda não foram implementadas; sua exposição e a conversão para os envelopes HTTP ficam no passo 8. A dependência de autenticação real e a chave estrangeira de usuária continuam pendentes conforme a seção 7.4.

### 7.8. Schemas e Endpoints HTTP — Passo 8

Estão implementados `GET /api/v1/reports/{id}`, `POST /api/v1/reports/{id}/confirm` e `POST /api/v1/reports/{id}/report-abuse`, com os formatos aprovados na seção 7.2. O router valida schemas, injeta dependências e delega ao serviço; não realiza consultas ao banco nem reimplementa regras de negócio. A rota estática `/reports/status` permanece declarada antes de `/{id}` para preservar seu funcionamento.

A consulta pública não depende de autenticação, inclusive quando a requisição contém um token inválido. Seu schema acrescenta `confirmations_count` aos campos públicos do relato, mantendo horário `HH:MM`, `created_at` em UTC com sufixo `Z` e campos opcionais como `null`. Não expõe autoria interna, dispositivo, estado de ocultação ou total de denúncias.

As mutações exigem corpo JSON `{}` e identidade autenticada. Corpo ausente, valores que não sejam objeto ou quaisquer campos adicionais são rejeitados com `422 VALIDATION_ERROR`. O UUID do caminho é validado como v4. Respostas bem-sucedidas usam `200` e os envelopes `confirmed: true` ou `abuse_registered: true`; erros `401`, `403`, `404`, `409`, `422` e `503` seguem o formato global. A dependência atual de autenticação continua retornando `503 AUTHENTICATION_UNAVAILABLE` para tokens válidos enquanto a consulta real de conta não for integrada, sem registrar interações.

Foram executados 210 testes. A cobertura funcional inclui detalhes públicos, validação de corpo/caminho, isolamento da identidade autenticada e envelopes de erro, além do fluxo HTTP com serviço e PostgreSQL/PostGIS reais: proibição da autora, confirmação idempotente, conflito entre ações opostas, atualização da contagem pública, denúncia aceita e ocultação, seguida de `404` para consulta e novas interações. Nesse fluxo, apenas a identidade é substituída explicitamente nos testes; o serviço e a persistência são reais.

Não houve alteração adicional de schema ou do contrato RF09 neste passo. A entrega integrada do RF07 ainda depende da consulta de usuárias, da chave estrangeira correspondente, da seção de comentários via RF08 e do alinhamento sobre endereço com os dados disponíveis. Não foram implementados agrupamento de zonas, comentários ou restauração administrativa.

### 7.9. Revisão Final RF07 — Passo 9

A revisão final executou 210 testes, sem falhas, incluindo PostgreSQL/PostGIS real, concorrência, reversão em falha e contratos HTTP. A cobertura de instruções e ramos medida no módulo `reports` foi de 99% (98% no serviço e 100% nos modelos, schemas e router); ela inclui código RF09 compartilhado e não representa cobertura de todo o backend. `alembic check` não identificou diferenças entre o banco de testes e os modelos. Ruff, Black e a verificação do diff passaram.

A separação permanece: modelos SQLAlchemy representam persistência; o serviço aplica as regras e controla transações; schemas Pydantic validam os formatos HTTP e selecionam os campos públicos; routers recebem requisições e delegam ao serviço. A revisão não adicionou regras novas. Não houve alteração no frontend, no README principal ou nas dependências declaradas; `backend/.env` permanece ignorado e não rastreado pelo Git.

**A implementação do recorte de relatos individuais está preparada para revisão, mas o RF07 não deve ser marcado como entrega integrada concluída.** Pendências:

- Integrar a consulta real de usuárias na dependência de autenticação e testar as mutações sem substituição da identidade. Por enquanto, tokens válidos continuam recebendo `503`, sem gravação.
- Adicionar as chaves estrangeiras reais de autoria/usuária, com migração e política de exclusão alinhadas ao módulo de usuárias. A referência da interação ao relato já é verificada pelo banco.
- Integrar a consulta de comentários do RF08, incluindo a política para relatos ocultados. Não há seção de comentários funcional nem resposta vazia simulada nesta implementação.
- Validar com a equipe se coordenadas e referência opcional atendem ao critério de endereço. Não há endereço postal completo nem geocodificação implementados.
- Tratar a exposição de parâmetros SQL em logs do núcleo compartilhado, já registrada na seção 6.10, antes de usar dados reais com log SQL de depuração ativo. Os testes foram executados com `DEBUG=false`.

A consulta de zonas agrupadas e o fluxo administrativo de revisão/restauração permanecem integrações futuras, conforme o escopo aprovado. A instalação de dependências continua sujeita à limitação de reprodutibilidade com SQLAlchemy 2.1 documentada na seção 6.10; a validação desta revisão usou SQLAlchemy 2.0, sem mudar a faixa declarada.
