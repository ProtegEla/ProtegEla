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
| **reports** | `POST` | `/api/v1/reports` | Registro de incidente (RF09) | Rota implementada; consulta de conta pendente |
| **reports** | `POST` | `/api/v1/reports/{id}/confirm` | Confirmação da veracidade do relato (RN01) | Proposta em discussão |
| **reports** | `POST` | `/api/v1/reports/{id}/report-abuse` | Denúncia de relato falso/impróprio (RN06) | Proposta em discussão |
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
