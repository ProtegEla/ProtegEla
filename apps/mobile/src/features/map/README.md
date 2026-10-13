# Feature: Map (Mobile)

## Responsabilidade
- Renderização do mapa interativo da cidade de São Paulo (RF05).
- Exibição de marcadores visuais coloridos e polígonos de zonas de risco (RF06, RN03).
- Marcadores de estabelecimentos de apoio (delegacias da mulher, hospitais) (RF12).
- Modal com detalhes do incidente ao tocar no marcador (RF07).
- Centralização rápida na localização GPS da usuária.

## Diretrizes Técnicas
- Isolar a implementação do mapa em componentes com suporte a extensões de plataforma (`.native.tsx` / `.web.tsx`), facilitando testes e portabilidade.
