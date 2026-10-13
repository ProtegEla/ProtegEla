# Módulo: Risk Zones (Agrupamento e Cálculo de Zonas de Risco)

## 1. Escopo e Requisitos Associados
- **RF06**: Exibição de polígonos e marcadores de zonas de risco no mapa.
- **RN01 / RN02**: Classificação e pontuação de risco acumulada com níveis (moderado, alto, extremo).
- **RN03**: Agrupamento espacial de incidentes em raio de até 20 metros.
- **RN04 / RN05**: Penalidade de custo em vias e amortização temporal (6 meses relatos / 12 meses SSP).

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/risk-zones/*` e esquemas GeoJSON.
- `service.py`: Fórmulas matemáticas de decaimento, severidade e lógica de agregação espacial.
- `models.py`: Modelos SQLAlchemy com suporte a geometrias PostGIS.
