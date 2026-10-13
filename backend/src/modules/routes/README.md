# Módulo: Routes (Cálculo e Navegação de Rotas Seguras)

## 1. Escopo e Requisitos Associados
- **RF15**: Cálculo de rota do ponto A ao B para pedestres evitando zonas de risco.
- **RN04**: Penalidade de custo proporcional em vias com histórico de incidentes.
- **RN07**: Comparação com rota rápida e emissão de alerta se desvio > 30% do tempo.
- **RNF03 / RNF10**: Resiliência e tratamento de falhas da API do OpenRouteService.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rota `/api/v1/routes/calculate` e esquemas de pontos de trajeto.
- `service.py`: Lógica de integração com OpenRouteService e validação do limite de 30%.
- `models.py`: Modelos SQLAlchemy para histórico de rotas salvas.
