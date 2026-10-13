# Módulo: Support Locations (Estabelecimentos de Apoio e Delegacias)

## 1. Escopo e Requisitos Associados
- **RF12**: Exibição no mapa e listagem das delegacias e hospitais mais próximos via Overpass API (OSM).
- **RNF10**: Resiliência e tratamento de falhas da Overpass API com cache local.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/support-locations/*` e filtros de raio geográfico.
- `service.py`: Cliente Overpass API, cálculo de proximidade e política de fallback.
- `models.py`: Modelos SQLAlchemy para persistência e cache com PostGIS.
