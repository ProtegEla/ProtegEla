# Metodologia de Tratamento e Carga de Dados Oficiais (SSP-SP)

Este documento registra as decisões de produto e engenharia para o tratamento das planilhas oficiais da Secretaria de Segurança Pública de São Paulo (`SPDadosCriminais_*.xlsx`) usadas na composição das **Zonas de Risco (RF05 / RF06 / RN03 / RF15)**.

---

## 1. Escopo Geográfico e Fonte
* **Recorte Municipal (RF05):** Apenas ocorrências no município de **São Paulo** (`NOME_MUNICIPIO = S.PAULO` → normalizado para `SAO PAULO`).
* **Validação por Contorno Oficial (`GeoJSON`):** O arquivo `backend/data/sp_municipio.geojson` (malha oficial do IBGE, código `3550308`) é usado **exclusivamente durante a importação no backend** como cerca geométrica para descartar registros com coordenadas corrompidas, zeradas, invertidas ou fora dos limites de São Paulo. Ele **não** é desenhado no mapa do aplicativo.
* **Armazenamento Enxuto:** O arquivo `.xlsx` bruto não vai para o banco nem para o Git. Apenas os registros filtrados e válidos são gravados na tabela `ssp_safety_records` (com `source_period`, `source_url` e `file_sha256` para rastreabilidade).

---

## 2. Critérios de Filtragem

### 2.1. Privacidade e Geometria
* Descartar registros com `LOGRADOURO` contendo `"VEDAÇÃO DA DIVULGAÇÃO"` (sigilo legal LGPD/ECA/crimes sexuais).
* Descartar registros com `LATITUDE` ou `LONGITUDE` ausentes, `NULL`, `0` ou fora do polígono de São Paulo.

### 2.2. Tipo de Local (`DESCR_TIPOLOCAL`)
O objetivo do ProtegEla é avaliar o risco para a **mulher se deslocando a pé na rua**. Por isso:
* **Incluídos:** `Via Pública`, `Terminal/Estação`, `Estacionamento/Garagem`, `Area não Ocupada`, `Comércio e Serviços`, `Centro Comercial/Empresarial`.
* **Excluídos:** `Residência`, `Condomínio Residencial`, `Unidade Rural` e demais ambientes internos privados (ocorrências estritamente domiciliares não refletem o risco da via pública para pedestres).

### 2.3. Natureza da Ocorrência (`RUBRICA`)
Definido em conjunto com a equipe na migração `0010_expand_ssp_categories`:

| Rubrica SSP-SP | Categoria no App | Decisão |
| --- | --- | --- |
| `Furto (art. 155)` | `Furto` | ✅ Incluído |
| `Roubo (art. 157)` | `Roubo` | ✅ Incluído |
| `Lesão corporal (art. 129)` | `Violência` | ✅ Incluído |
| `Homicídio (art. 121)` | `Violência` | ✅ Incluído |
| `Feminicídio` | `Violência` | ✅ Incluído |
| `Extorsão mediante seqüestro (art. 159)` | `Violência` | ✅ Incluído |
| `Estupro` / `Importunação sexual` | `Assédio` | ✅ Mapeado (embora a SSP zere coordenadas por sigilo) |
| Trânsito (`culposa na direção...`, `Atropelamento`, `Choque`) | — | ❌ Excluído (acidente viário, não violência urbana) |
| `Tráfico de drogas` / `Porte de arma` | — | ❌ Excluído por decisão de escopo |
| Administrativos (`Apreensão`, `Comunicação de óbito`, `Falsidade`, etc.) | — | ❌ Excluído |

---

## 3. Fluxo de Atualização Incremental (Novos Meses)
Quando a SSP-SP publicar uma versão atualizada da planilha com novos meses:

1. **Extrair e filtrar o CSV normalizado** (a partir da pasta `backend/`):
   ```powershell
   .\venv\Scripts\python.exe -m src.modules.risk_zones.extract_ssp_csv ..\SPDadosCriminais_2026.xlsx -o data\ssp_sp_2026.csv
   ```
2. **Importar no Supabase (idempotente — sem duplicar registros antigos):**
   ```powershell
   .\venv\Scripts\python.exe -m src.modules.risk_zones.import_ssp data\ssp_sp_2026.csv --boundary data\sp_municipio.geojson --period 2026 --source-url https://www.ssp.sp.gov.br/estatistica/consultas
   ```
   O importador gera uma chave SHA-256 única (`NOME_DELEGACIA + ANO_BO + NUM_BO`) e compara `VERSAO`, inserindo apenas boletins novos e atualizando retificações sem duplicar dados no banco.
