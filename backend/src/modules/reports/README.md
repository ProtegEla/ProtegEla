# Módulo: Reports (Relatos Colaborativos de Incidentes)

## 1. Escopo e Requisitos Associados
- **RF06**: Exibição de pontos de perigo reportados pela comunidade e de bases públicas.
- **RF07**: Detalhes do relato (categoria, descrição, data/horário, confirmações e denúncias).
- **RF09**: Registro de incidentes no mapa com categorias padronizadas e opção de anonimato.
- **RN01 / RN05**: Confirmações de veracidade por usuárias distintas e cálculo de validade temporal.
- **RN06**: Rate limit de criação por dispositivo e ocultação automática se denúncias > 30% das confirmações.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/reports/*` e injeção de dependências, sem consultas ao banco.
- `schemas.py`: Schemas Pydantic de entrada/saída e conversão dos campos públicos.
- `service.py`: Criação, consulta pública de detalhes, confirmações, denúncias e ocultação transacional pela RN06.
- `models.py`: Modelos SQLAlchemy para relatos e interações de confirmação/denúncia, com unicidade por usuária e relato.

## 3. Endpoints RF07

- `GET /api/v1/reports/{id}`: detalhes públicos de relato visível, com total de confirmações.
- `POST /api/v1/reports/{id}/confirm`: confirmação autenticada, corpo `{}`.
- `POST /api/v1/reports/{id}/report-abuse`: denúncia autenticada, corpo `{}`.

Relatos ocultados retornam `404`. As mutações permanecem protegidas com `503` para tokens válidos enquanto não existir consulta real de conta. A chave estrangeira de usuária e a seção de comentários via RF08 continuam pendentes. Os contratos e as regras aprovadas estão na seção 7 de `docs/api_contracts.md`.
