# Estado Atual do Sistema ProtegEla e Decisões de Arquitetura

Este documento formaliza o status atual do projeto **ProtegEla**, o progresso em relação aos requisitos do sistema ([doc_inicial.md](file:///docs/doc_inicial.md)), o mapeamento das branches ativas no repositório e todas as decisões técnicas tomadas pela equipe de desenvolvimento.

---

## 1. Visão Geral do Sistema e Ambiente

O **ProtegEla** é uma plataforma colaborativa voltada à segurança de mulheres em deslocamentos urbanos, com foco inicial na Região Metropolitana de São Paulo.

### Tecnologias em Operação
- **Front-end Mobile**: React Native com Expo (SDK 54), Expo Router baseado em arquivos e React Native Maps / WebView (OpenStreetMap).
- **Back-end**: Python 3.13 com FastAPI estruturado como Monólito Modular em camadas (`router.py`, `service.py`, `models.py`).
- **Banco de Dados**: PostgreSQL local nativo com extensão espacial PostGIS.
- **Serviços Geoespaciais Externos**:
  - OpenStreetMap (OSM) via Overpass API para pontos de apoio (delegacias, postos policiais e DDMs).
  - OpenRouteService (ORS) / Pelias para busca preditiva de endereços e cálculo de rotas seguras de pedestres.
  - Nominatim (OSM) como fallback transparente de busca de endereços no cliente.

---

## 2. Matriz de Requisitos e Status de Implementação

| Requisito | Descrição | Back-end | Front-end | Status Geral | Observações / Localização |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **RF01** | Cadastro de Usuárias (Anônimo e Completo) | ✅ Concluído | ✅ Concluído | **Concluído** | Módulo `auth` e `users` com criptografia Fernet (LGPD). |
| **RF02** | Autenticação e Login JWT | ✅ Concluído | ✅ Concluído | **Concluído** | Telas `login.tsx` e `register.tsx`. |
| **RF03** | Visualização do Mapa de Calor / Risco | ✅ Concluído | ✅ Concluído | **Concluído** | Renderização dinâmica em [RiskMap.tsx](file:///apps/mobile/src/features/map/components/RiskMap.tsx). |
| **RF04** | Acesso às Funcionalidades Básicas sem Login | ✅ Concluído | ✅ Concluído | **Concluído** | Geração e persistência de `device_id` local. |
| **RF05** | Filtros de Visualização no Mapa | ✅ Concluído | ✅ Concluído | **Concluído** | Filtros por tipo de perigo, gravidade e período. |
| **RF06** | Registro de Incidentes / Relatos | ✅ Concluído | ✅ Concluído | **Concluído** | `CreateReportBottomSheet.tsx` com categorias (iluminação, assédio, etc.). |
| **RF07** | Comentários em Relatos | ✅ Concluído | ⏳ Parcial | **Em Integração** | Backend em `modules/comments`; branch `integracao/login-relatos`. |
| **RF08** | Validação / Confirmação de Relatos por Terceiros | ✅ Concluído | ⏳ Parcial | **Em Integração** | Upvotes e moderação de relatos comunitários. |
| **RF09** | Geolocalização Automática e Manual de Incidentes | ✅ Concluído | ✅ Concluído | **Concluído** | Permite registrar no local atual, pesquisar endereço ou tocar no mapa. |
| **RF10** | Lista de Telefones Úteis de Emergência | ✅ Concluído | ⏳ Aguardando PR | **Aguardando PR** | Tela pronta na branch `feat/front-end/tela-telefones`. |
| **RF11** | Orientações e Dicas de Segurança | ✅ Concluído | ✅ Concluído | **Concluído** | Tela [orientacoes.tsx](file:///apps/mobile/app/orientacoes.tsx) integrada à `develop`. |
| **RF12** | Consulta de Delegacias Próximas | ✅ Concluído | ✅ Concluído | **Concluído** | Endpoint `/support-locations/nearby` com fallback multi-servidor e cache local. |
| **RF13** | Alertas de Proximidade de Risco | ✅ Concluído | ⏳ Pendente | **Próxima Etapa** | Background task / geofencing em desenvolvimento. |
| **RF14** | Botão de Pânico / Acionamento Rápido | ✅ Concluído | ✅ Concluído | **Concluído** | Tela `emergency.tsx` e atalho persistente na barra inferior. |
| **RF15** | Cálculo e Comparativo de Rotas Seguras | ✅ Concluído | ⏳ Próxima Etapa | **Próxima Etapa** | Backend pronto em `modules/routes`; frontend será iniciado na nova branch. |
| **RF16** | Recuperação de Senha por E-mail | ✅ Concluído | ⏳ Parcial | **Em Revisão** | Fluxo backend validado; pendente tela mobile final. |
| **RF17** | Gestão de Contatos de Emergência | ✅ Concluído | ✅ Concluído | **Concluído** | Criptografia simétrica no banco e chamada rápida. |

---

## 3. Decisões Arquiteturais Registradas (ADRs)

### ADR 01: Otimização de Performance e Cota no Módulo de Locais de Apoio (RF12)
- **Problema**: O endpoint `GET /api/v1/support-locations/nearby` realizava uma consulta ao Overpass que retornava até 80 delegacias em São Paulo e, em seguida, disparava requisições sequenciais individuais ao OpenRouteService para calcular a distância a pé de cada uma. Isso consumia toda a cota da chave gratuita do ORS (limite de 40 requisições/minuto), disparando erros `429 Too Many Requests` e `503 Service Unavailable`, com latência de resposta superior a 25 segundos.
- **Decisão**: 
  1. O backend realiza **uma única requisição** ao Overpass, extraindo todas as delegacias no raio estipulado (5 km).
  2. A distância de cada ponto é calculada no próprio servidor utilizando a fórmula geodésica de **Haversine** (tempo de computação < 0.1ms, zero consumo de chamadas de API externa).
  3. A lista completa é devolvida ao frontend, que calcula/ordena dinamicamente em relação à posição da usuária e armazena em cache no `AsyncStorage`.
- **Resultado**: Latência reduzida de ~25s para ~1.5s; eliminação de erros 429; economia de 100% da cota de roteamento para o cálculo de rotas reais.

### ADR 02: Resiliência em Cascata para Overpass API (OpenStreetMap)
- **Problema**: O servidor público alemão padrão da Overpass (`overpass-api.de`) opera frequentemente no limite de capacidade, retornando erros `502 Gateway Timeout` ("All query workers are busy and request queue is full").
- **Decisão**: O cliente HTTP em [backend/src/modules/support_locations/clients.py](file:///backend/src/modules/support_locations/clients.py) implementou um mecanismo de **fallback transparente entre múltiplos espelhos públicos**:
  1. `https://overpass.openstreetmap.fr/api/interpreter` (França - prioritário)
  2. `https://overpass.kumi.systems/api/interpreter`
  3. `https://overpass-api.de/api/interpreter` (Alemanha)
  4. `https://z.overpass-api.de/api/interpreter`
  5. `https://lz4.overpass-api.de/api/interpreter`
  Além disso, adicionou-se o cabeçalho oficial `User-Agent: ProtegEla-App/1.0`, exigido pelas diretrizes da comunidade OSM.
- **Resultado**: Alta disponibilidade e tolerância a falhas externas sem interrupção do serviço para o usuário final.

### ADR 03: Política de Cache no Dispositivo e Eliminação de Contingência Fictícia (RNF03, RNF10)
- **Problema**: O serviço do frontend continha uma lista estática mockada com delegacias fixas do centro de São Paulo como contingência para falhas de rede, o que exibia dados incorretos quando o app era utilizado em outras cidades ou bairros distantes.
- **Decisão**: A lista estática foi completamente removida de [supportLocations.ts](file:///apps/mobile/src/services/api/supportLocations.ts). O sistema opera exclusivamente com:
  1. Dados reais obtidos da API para a coordenada geográfica atual.
  2. Cache local persistido no aparelho via `AsyncStorage` (`@protegela:cached_support_locations`), preservando o histórico de locais reais visitados.
  3. Lista vazia controlada (`[]`) caso o aparelho esteja offline e ainda não possua cache daquela área.

### ADR 04: Busca Preditiva de Endereços com Resiliência no Cliente
- **Implementação**: Foi integrado o endpoint `GET /api/v1/addresses/suggestions?q=...` ao cabeçalho do mapa mobile.
- **Decisão de UX/Performance**:
  - Debounce de 300 ms nas digitações da usuária.
  - Cancelamento/descarte de respostas defasadas para evitar concorrência.
  - Fallback automático no cliente para o serviço público Nominatim (`nominatim.openstreetmap.org`) caso o backend ou a chave do ORS Pelias estejam indisponíveis.

### ADR 05: Flexibilização da Seleção de Localização no Registro de Incidentes (RF09)
- **Problema**: Vítimas de situações de perigo ou assédio costumam registrar o relato após saírem da cena e chegarem a um local seguro (residência, delegacia, transporte público). Se o aplicativo forçasse apenas o GPS em tempo real, os dados de manchas criminais seriam distorcidos.
- **Decisão**: A interface de [CreateReportBottomSheet.tsx](file:///apps/mobile/src/features/reports/components/CreateReportBottomSheet.tsx) agora permite à usuária:
  - Usar a localização GPS atual (padrão).
  - Buscar pelo nome da rua/bairro onde o incidente ocorreu.
  - Tocar diretamente no mapa para reposicionar o pino do relato com precisão.

---

## 4. Estado das Branches do Git

| Branch | Responsabilidade | Status Atual | Próxima Ação |
| :--- | :--- | :--- | :--- |
| **`develop`** | Linha principal de desenvolvimento integrado | Atualizada com PR #59 (`orientacoes.tsx`) | Receber o PR da branch atual. |
| **`front-end(pontos-de-perigo)`** *(Atual)* | Mapa, busca de endereços, locais de apoio e relatos | Concluída, testada e sincronizada | **Abrir Pull Request para `develop`**. |
| **`feat/front-end/tela-delegacias`** | Tela de listagem dedicada de delegacias (`delegacias.tsx`) | Código concluído pelo colega | Colega responsável deve abrir PR na `develop`. |
| **`feat/front-end/tela-telefones`** | Tela de listagem de telefones úteis (`telefones.tsx`) | Código concluído pelo colega | Colega responsável deve abrir PR na `develop`. |
| **`feat/rotas-backend`** | Backend de cálculo de rotas seguras e desvio de risco | Mergeado na `develop` | Servirá de base para a nova tela de rotas no mobile. |

---

## 5. Próximos Passos Imediatos

1. **Submissão do Pull Request**: Integrar as alterações de `front-end(pontos-de-perigo)` na `develop`.
2. **Criação da Branch de Rotas**: Criar a branch `feat/front-end/rotas-seguras` a partir da `develop` atualizada.
3. **Construção da Interface de Rotas (RF15)**:
   - Campo de busca de destino com autocomplete.
   - Chamada ao endpoint `POST /api/v1/routes/calculate`.
   - Renderização da rota sugerida (verde) vs rota mais rápida com risco (laranja/vermelha) no mapa com `Polyline`.
   - Card comparativo de tempo estimado, distância e nível de segurança da rota.
