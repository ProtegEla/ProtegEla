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
| **reports** | `POST` | `/api/v1/reports` | Registro de incidente (RF09) | Proposta em discussão |
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
