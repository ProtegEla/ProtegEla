# Módulo: Reports (Relatos Colaborativos de Incidentes)

## 1. Escopo e Requisitos Associados
- **RF06**: Exibição de pontos de perigo reportados pela comunidade e de bases públicas.
- **RF07**: Detalhes do relato (categoria, descrição, data/horário, confirmações e denúncias).
- **RF09**: Registro de incidentes no mapa com categorias padronizadas e opção de anonimato.
- **RN01 / RN05**: Confirmações de veracidade por usuárias distintas e cálculo de validade temporal.
- **RN06**: Rate limit de criação por dispositivo e ocultação automática se denúncias > 30% das confirmações.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/reports/*` e esquemas Pydantic.
- `service.py`: Lógica de validação de relatos, checagem da taxa de denúncias e decaimento temporal.
- `models.py`: Modelos SQLAlchemy para relatos, confirmações e denúncias.
