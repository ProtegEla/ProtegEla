# Avaliação de Estratégia Front-End Web

Este documento analisa as duas opções arquiteturais para o suporte à Web no projeto **ProtegEla**, fornecendo subsídios técnicos para a tomada de decisão da equipe.

---

## 1. Contexto e Desafio

O ProtegEla tem como foco central a mobilidade urbana da usuária em deslocamento na cidade de São Paulo, o que demanda recursos nativos típicos de smartphones:
- Geolocalização de alta precisão em segundo plano (Foreground Service).
- Botão de pânico com acionamento de discagem telefônica nativa (190 / contato).
- Integração direta com deep links do WhatsApp.

A versão Web atende prioritariamente a usuárias em computadores ou navegadores móveis para consulta de zonas de risco, leitura de relatos educativos e planejamento prévio de deslocamento.

---

## 2. Comparativo Técnico entre as Abordagens

| Critério | Opção A: Expo com React Native Web | Opção B: Aplicação React Web Independente (`apps/web`) |
| :--- | :--- | :--- |
| **Base de Código** | **100% Unificada**: Mesmo repositório de telas e componentes em `apps/mobile`. | **Separada**: `apps/mobile` para app nativo e `apps/web` (Vite/Next) para web. |
| **Esforço de Manutenção** | **Baixo**: Menor duplicação de regras de UI, hooks e serviços de API. | **Médio/Alto**: Necessidade de sincronizar alterações visuais e regras entre dois apps. |
| **Ecossistema de Mapas** | **Complexo na Web**: `react-native-maps` possui suporte limitado no navegador, exigindo adaptadores (`@teovilla/react-native-web-maps`) ou abstração condicional. | **Excelente na Web**: Uso nativo de bibliotecas consagradas como Leaflet (`react-leaflet`) ou MapLibre GL. |
| **Recursos Nativos Móveis** | Exige tratamento de condicionais (`Platform.OS === 'web'`) para chamadas telefônicas e serviços em segundo plano. | Isolamento total: a versão web não carrega dependências ou shims móveis desnecessários. |
| **Performance e SEO** | Bundle gerado pelo compilador do React Native Web é maior; renderização via styled DOM. | Bundle altamente otimizado via Vite; carregamento rápido e semântica HTML pura. |

---

## 3. Como Executar a Versão Web sem Duplicar Código (Opção A)

Se a equipe optar pelo **Expo com React Native Web**:

1. A versão web é executada diretamente a partir de `apps/mobile`, sem a necessidade de criar arquivos repetidos em `apps/web`.
2. O Expo SDK suporta nativamente a exportação web através do Metro Bundler:
   ```bash
   cd apps/mobile
   npm run web   # executa: npx expo start --web
   ```
3. **Padrão de Abstração para Recursos Nacionais**:
   - Para mapas e módulos que diferem entre celular e navegador, utilize a convenção de extensões do Expo/Metro:
     - `RiskMap.native.tsx`: Renderiza usando `react-native-maps`.
     - `RiskMap.web.tsx`: Renderiza usando biblioteca web (ex: Leaflet ou canvas).
   - O código consumidor apenas importa `./RiskMap`, garantindo código limpo e sem duplicação de lógica de negócio.

---

## 4. Estrutura caso a Equipe Opte por App Web Independente (Opção B)

Caso a equipe prefira isolamento completo de tecnologias para explorar um dashboard web desktop com Leaflet/OpenStreetMap puro:
- O diretório `apps/web/` foi reservado na estrutura do monorepo.
- Ele consumirá a mesma API FastAPI (`/api/v1`) e os mesmos contratos descritos em `docs/api_contracts.md`.

---

## 5. Recomendação Arquitetural

> [!TIP]
> **Recomendação Inicial:** Priorizar o desenvolvimento em `apps/mobile` com Expo. Avaliar a execução web pelo próprio Expo (`npx expo start --web`) para evitar sobrecarga de manutenção em um time acadêmico. Apenas ativar `apps/web` independente caso as restrições de renderização de mapas na web justifiquem a manutenção de um segundo projeto front-end.
